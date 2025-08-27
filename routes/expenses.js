const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const Balance = require('../models/Balance');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
    }
  }
});

// @route   GET /api/expenses
// @desc    Get expenses for user (across all groups or specific group)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { groupId, page = 1, limit = 20, category, startDate, endDate } = req.query;

    // Build filter
    const filter = {
      isDeleted: false,
      $or: [
        { 'paidBy.user': req.user._id },
        { 'splitBetween.user': req.user._id }
      ]
    };

    if (groupId) {
      // Verify user is member of the group
      const group = await Group.findOne({
        _id: groupId,
        'members.user': req.user._id,
        'members.isActive': true,
        isDeleted: false
      });

      if (!group) {
        return res.status(404).json({ message: 'Group not found or access denied' });
      }

      filter.group = groupId;
    } else {
      // Get all groups user is a member of
      const userGroups = await Group.find({
        'members.user': req.user._id,
        'members.isActive': true,
        isDeleted: false
      }).select('_id');

      filter.group = { $in: userGroups.map(g => g._id) };
    }

    if (category) {
      filter.category = category;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('group', 'name currency')
      .populate('createdBy', 'name email avatar')
      .populate('paidBy.user', 'name email avatar')
      .populate('splitBetween.user', 'name email avatar')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Expense.countDocuments(filter);

    res.json({
      expenses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Server error while fetching expenses' });
  }
});

// @route   POST /api/expenses
// @desc    Create a new expense
// @access  Private
router.post('/', [
  auth,
  upload.single('receipt'),
  body('description').trim().isLength({ min: 1, max: 200 }).withMessage('Description is required and must be less than 200 characters'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  body('groupId').isMongoId().withMessage('Valid group ID is required'),
  body('date').optional().isISO8601().withMessage('Date must be in valid ISO format'),
  body('category').optional().isIn(['food', 'transport', 'accommodation', 'entertainment', 'shopping', 'utilities', 'healthcare', 'other']),
  body('splitType').isIn(['equal', 'exact', 'percentage']).withMessage('Split type must be equal, exact, or percentage'),
  body('paidBy').isArray({ min: 1 }).withMessage('At least one payer is required'),
  body('splitBetween').isArray({ min: 1 }).withMessage('At least one person to split with is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const {
      description,
      amount,
      currency,
      groupId,
      date,
      category,
      splitType,
      paidBy,
      splitBetween,
      notes,
      tags,
      isRecurring,
      recurringDetails
    } = req.body;

    // Verify group exists and user is member
    const group = await Group.findOne({
      _id: groupId,
      'members.user': req.user._id,
      'members.isActive': true,
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found or access denied' });
    }

    // Validate paidBy and splitBetween arrays
    const paidByParsed = JSON.parse(paidBy);
    const splitBetweenParsed = JSON.parse(splitBetween);

    // Verify all users are group members
    const groupMemberIds = group.getActiveMembers().map(m => m.user.toString());
    
    for (const payment of paidByParsed) {
      if (!groupMemberIds.includes(payment.user)) {
        return res.status(400).json({ message: 'All payers must be group members' });
      }
    }

    for (const split of splitBetweenParsed) {
      if (!groupMemberIds.includes(split.user)) {
        return res.status(400).json({ message: 'All split participants must be group members' });
      }
    }

    // Create expense
    const expense = new Expense({
      description,
      amount,
      currency,
      group: groupId,
      date: date ? new Date(date) : new Date(),
      category: category || 'other',
      splitType,
      paidBy: paidByParsed,
      splitBetween: splitBetweenParsed,
      notes: notes || '',
      tags: tags ? JSON.parse(tags) : [],
      createdBy: req.user._id,
      receipt: req.file ? `/uploads/receipts/${req.file.filename}` : null,
      isRecurring: isRecurring || false,
      recurringDetails: isRecurring ? JSON.parse(recurringDetails) : undefined
    });

    // Calculate split amounts based on type
    if (splitType === 'equal') {
      expense.calculateEqualSplit();
    } else if (splitType === 'percentage') {
      expense.calculatePercentageSplit();
    }

    await expense.save();

    // Update balances
    for (const payment of expense.paidBy) {
      for (const split of expense.splitBetween) {
        if (payment.user.toString() !== split.user.toString()) {
          await Balance.updateBalance(
            groupId,
            payment.user,
            split.user,
            split.amount * (payment.amount / expense.amount),
            currency
          );
        }
      }
    }

    // Create recurring expenses if needed
    if (isRecurring && recurringDetails) {
      const recurringService = require('../services/recurringExpenseService');
      await recurringService.scheduleRecurringExpense(expense);
    }

    await expense.populate('group', 'name currency');
    await expense.populate('createdBy', 'name email avatar');
    await expense.populate('paidBy.user', 'name email avatar');
    await expense.populate('splitBetween.user', 'name email avatar');

    // Create notifications for all involved users
    const involvedUsers = new Set();
    expense.paidBy.forEach(p => involvedUsers.add(p.user._id.toString()));
    expense.splitBetween.forEach(s => involvedUsers.add(s.user._id.toString()));

    for (const userId of involvedUsers) {
      if (userId !== req.user._id.toString()) {
        await Notification.createAndSend({
          recipient: userId,
          sender: req.user._id,
          type: 'expense_added',
          title: 'New expense added',
          message: `${req.user.name} added "${description}" in ${group.name}`,
          data: {
            expenseId: expense._id,
            groupId: group._id,
            amount: expense.amount,
            currency: expense.currency
          }
        });
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(`group_${groupId}`).emit('expense_added', { expense });

    res.status(201).json({
      message: 'Expense created successfully',
      expense
    });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ message: 'Server error while creating expense' });
  }
});

// @route   GET /api/expenses/:id
// @desc    Get expense details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      isDeleted: false
    })
    .populate('group', 'name currency members')
    .populate('createdBy', 'name email avatar')
    .populate('paidBy.user', 'name email avatar')
    .populate('splitBetween.user', 'name email avatar');

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user is involved in this expense
    const isInvolved = expense.paidBy.some(p => p.user._id.toString() === req.user._id.toString()) ||
                      expense.splitBetween.some(s => s.user._id.toString() === req.user._id.toString());

    if (!isInvolved) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ expense });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ message: 'Server error while fetching expense' });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', [
  auth,
  upload.single('receipt'),
  body('description').optional().trim().isLength({ min: 1, max: 200 }),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('date').optional().isISO8601(),
  body('category').optional().isIn(['food', 'transport', 'accommodation', 'entertainment', 'shopping', 'utilities', 'healthcare', 'other']),
  body('splitType').optional().isIn(['equal', 'exact', 'percentage'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const expense = await Expense.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user can edit (creator or group admin)
    const group = await Group.findById(expense.group);
    const canEdit = expense.createdBy.toString() === req.user._id.toString() || 
                   group.isAdmin(req.user._id);

    if (!canEdit) {
      return res.status(403).json({ message: 'You can only edit expenses you created or as a group admin' });
    }

    // Store old values for balance recalculation
    const oldPaidBy = expense.paidBy;
    const oldSplitBetween = expense.splitBetween;
    const oldAmount = expense.amount;

    // Update expense fields
    const {
      description,
      amount,
      currency,
      date,
      category,
      splitType,
      paidBy,
      splitBetween,
      notes,
      tags
    } = req.body;

    if (description) expense.description = description;
    if (amount) expense.amount = amount;
    if (currency) expense.currency = currency;
    if (date) expense.date = new Date(date);
    if (category) expense.category = category;
    if (notes !== undefined) expense.notes = notes;
    if (tags) expense.tags = JSON.parse(tags);
    if (req.file) expense.receipt = `/uploads/receipts/${req.file.filename}`;

    if (splitType) {
      expense.splitType = splitType;
    }

    if (paidBy) {
      expense.paidBy = JSON.parse(paidBy);
    }

    if (splitBetween) {
      expense.splitBetween = JSON.parse(splitBetween);
      
      // Recalculate split amounts
      if (expense.splitType === 'equal') {
        expense.calculateEqualSplit();
      } else if (expense.splitType === 'percentage') {
        expense.calculatePercentageSplit();
      }
    }

    await expense.save();

    // Recalculate balances if amounts or participants changed
    if (amount || paidBy || splitBetween) {
      // Reverse old balance effects
      for (const payment of oldPaidBy) {
        for (const split of oldSplitBetween) {
          if (payment.user.toString() !== split.user.toString()) {
            await Balance.updateBalance(
              expense.group,
              payment.user,
              split.user,
              -split.amount * (payment.amount / oldAmount),
              expense.currency
            );
          }
        }
      }

      // Apply new balance effects
      for (const payment of expense.paidBy) {
        for (const split of expense.splitBetween) {
          if (payment.user.toString() !== split.user.toString()) {
            await Balance.updateBalance(
              expense.group,
              payment.user,
              split.user,
              split.amount * (payment.amount / expense.amount),
              expense.currency
            );
          }
        }
      }
    }

    await expense.populate('group', 'name currency');
    await expense.populate('createdBy', 'name email avatar');
    await expense.populate('paidBy.user', 'name email avatar');
    await expense.populate('splitBetween.user', 'name email avatar');

    // Create notifications
    const involvedUsers = new Set();
    expense.paidBy.forEach(p => involvedUsers.add(p.user._id.toString()));
    expense.splitBetween.forEach(s => involvedUsers.add(s.user._id.toString()));

    for (const userId of involvedUsers) {
      if (userId !== req.user._id.toString()) {
        await Notification.createAndSend({
          recipient: userId,
          sender: req.user._id,
          type: 'expense_updated',
          title: 'Expense updated',
          message: `${req.user.name} updated "${expense.description}" in ${expense.group.name}`,
          data: {
            expenseId: expense._id,
            groupId: expense.group._id,
            amount: expense.amount,
            currency: expense.currency
          }
        });
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(`group_${expense.group._id}`).emit('expense_updated', { expense });

    res.json({
      message: 'Expense updated successfully',
      expense
    });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ message: 'Server error while updating expense' });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense (soft delete)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if user can delete (creator or group admin)
    const group = await Group.findById(expense.group);
    const canDelete = expense.createdBy.toString() === req.user._id.toString() || 
                     group.isAdmin(req.user._id);

    if (!canDelete) {
      return res.status(403).json({ message: 'You can only delete expenses you created or as a group admin' });
    }

    // Soft delete
    expense.isDeleted = true;
    expense.deletedAt = new Date();
    expense.deletedBy = req.user._id;
    await expense.save();

    // Reverse balance effects
    for (const payment of expense.paidBy) {
      for (const split of expense.splitBetween) {
        if (payment.user.toString() !== split.user.toString()) {
          await Balance.updateBalance(
            expense.group,
            payment.user,
            split.user,
            -split.amount * (payment.amount / expense.amount),
            expense.currency
          );
        }
      }
    }

    // Create notifications
    const involvedUsers = new Set();
    expense.paidBy.forEach(p => involvedUsers.add(p.user._id.toString()));
    expense.splitBetween.forEach(s => involvedUsers.add(s.user._id.toString()));

    for (const userId of involvedUsers) {
      if (userId !== req.user._id.toString()) {
        await Notification.createAndSend({
          recipient: userId,
          sender: req.user._id,
          type: 'expense_deleted',
          title: 'Expense deleted',
          message: `${req.user.name} deleted "${expense.description}" from ${group.name}`,
          data: {
            expenseId: expense._id,
            groupId: expense.group,
            amount: expense.amount,
            currency: expense.currency
          }
        });
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(`group_${expense.group}`).emit('expense_deleted', { 
      expenseId: expense._id,
      groupId: expense.group 
    });

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Server error while deleting expense' });
  }
});

// @route   POST /api/expenses/:id/restore
// @desc    Restore deleted expense
// @access  Private
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      isDeleted: true
    });

    if (!expense) {
      return res.status(404).json({ message: 'Deleted expense not found' });
    }

    // Check if user can restore (creator or group admin)
    const group = await Group.findById(expense.group);
    const canRestore = expense.createdBy.toString() === req.user._id.toString() || 
                      group.isAdmin(req.user._id);

    if (!canRestore) {
      return res.status(403).json({ message: 'You can only restore expenses you created or as a group admin' });
    }

    // Restore expense
    expense.isDeleted = false;
    expense.deletedAt = null;
    expense.deletedBy = null;
    await expense.save();

    // Restore balance effects
    for (const payment of expense.paidBy) {
      for (const split of expense.splitBetween) {
        if (payment.user.toString() !== split.user.toString()) {
          await Balance.updateBalance(
            expense.group,
            payment.user,
            split.user,
            split.amount * (payment.amount / expense.amount),
            expense.currency
          );
        }
      }
    }

    await expense.populate('group', 'name currency');
    await expense.populate('createdBy', 'name email avatar');
    await expense.populate('paidBy.user', 'name email avatar');
    await expense.populate('splitBetween.user', 'name email avatar');

    // Emit socket event
    const io = req.app.get('io');
    io.to(`group_${expense.group._id}`).emit('expense_restored', { expense });

    res.json({
      message: 'Expense restored successfully',
      expense
    });
  } catch (error) {
    console.error('Restore expense error:', error);
    res.status(500).json({ message: 'Server error while restoring expense' });
  }
});

module.exports = router;