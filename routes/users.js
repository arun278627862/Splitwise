const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Balance = require('../models/Balance');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const csvWriter = require('csv-writer');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG) are allowed'));
    }
  }
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('groups');
    
    // Get user statistics
    const userGroups = await Group.find({
      'members.user': req.user._id,
      'members.isActive': true,
      isDeleted: false
    });

    const groupIds = userGroups.map(g => g._id);

    const totalExpenses = await Expense.countDocuments({
      group: { $in: groupIds },
      $or: [
        { 'paidBy.user': req.user._id },
        { 'splitBetween.user': req.user._id }
      ],
      isDeleted: false
    });

    const totalAmountPaid = await Expense.aggregate([
      {
        $match: {
          group: { $in: groupIds },
          'paidBy.user': req.user._id,
          isDeleted: false
        }
      },
      {
        $unwind: '$paidBy'
      },
      {
        $match: {
          'paidBy.user': req.user._id
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$paidBy.amount' }
        }
      }
    ]);

    const stats = {
      totalGroups: userGroups.length,
      totalExpenses,
      totalAmountPaid: totalAmountPaid.length > 0 ? totalAmountPaid[0].total : 0
    };

    res.json({
      user,
      stats
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  upload.single('avatar'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('timezone').optional().isString().withMessage('Timezone must be a string'),
  body('defaultCurrency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { name, phone, timezone, defaultCurrency } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (timezone) updateData.timezone = timezone;
    if (defaultCurrency) updateData.defaultCurrency = defaultCurrency;
    if (req.file) updateData.avatar = `/uploads/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

// @route   PUT /api/users/settings
// @desc    Update user notification settings
// @access  Private
router.put('/settings', [
  auth,
  body('emailNotifications').optional().isBoolean().withMessage('Email notifications must be a boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('Push notifications must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { emailNotifications, pushNotifications } = req.body;

    const updateData = {};
    if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.json({
      message: 'Settings updated successfully',
      user
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error while updating settings' });
  }
});

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get user's groups
    const groups = await Group.find({
      'members.user': req.user._id,
      'members.isActive': true,
      isDeleted: false
    })
    .populate('members.user', 'name email avatar')
    .sort({ updatedAt: -1 })
    .limit(5);

    // Get recent expenses
    const recentExpenses = await Expense.find({
      group: { $in: groups.map(g => g._id) },
      $or: [
        { 'paidBy.user': req.user._id },
        { 'splitBetween.user': req.user._id }
      ],
      isDeleted: false
    })
    .populate('group', 'name')
    .populate('createdBy', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get balances summary
    const balancesSummary = [];
    for (const group of groups) {
      const userBalances = await Balance.getUserBalances(group._id, req.user._id);
      const totalOwed = userBalances.reduce((sum, balance) => {
        return balance.amount > 0 ? sum + balance.amount : sum;
      }, 0);
      const totalOwing = userBalances.reduce((sum, balance) => {
        return balance.amount < 0 ? sum + Math.abs(balance.amount) : sum;
      }, 0);

      if (totalOwed > 0 || totalOwing > 0) {
        balancesSummary.push({
          group: {
            _id: group._id,
            name: group.name,
            currency: group.currency
          },
          totalOwed,
          totalOwing,
          netBalance: totalOwed - totalOwing
        });
      }
    }

    // Get monthly expense summary
    const monthlyExpenses = await Expense.aggregate([
      {
        $match: {
          group: { $in: groups.map(g => g._id) },
          'paidBy.user': req.user._id,
          isDeleted: false,
          date: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      },
      {
        $unwind: '$paidBy'
      },
      {
        $match: {
          'paidBy.user': req.user._id
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$paidBy.amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]);

    res.json({
      groups,
      recentExpenses,
      balancesSummary,
      monthlyExpenses
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ message: 'Server error while fetching dashboard data' });
  }
});

// @route   GET /api/users/search
// @desc    Search users by email
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email query parameter is required' });
    }

    const users = await User.find({
      email: { $regex: email, $options: 'i' },
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('name email avatar')
    .limit(10);

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error while searching users' });
  }
});

// @route   GET /api/users/export/expenses
// @desc    Export user expenses to CSV
// @access  Private
router.get('/export/expenses', auth, async (req, res) => {
  try {
    const { groupId, startDate, endDate } = req.query;

    // Build filter
    const filter = {
      isDeleted: false,
      $or: [
        { 'paidBy.user': req.user._id },
        { 'splitBetween.user': req.user._id }
      ]
    };

    if (groupId) {
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

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const expenses = await Expense.find(filter)
      .populate('group', 'name currency')
      .populate('createdBy', 'name email')
      .sort({ date: -1 });

    // Prepare CSV data
    const csvData = [];
    for (const expense of expenses) {
      const userPaid = expense.paidBy.find(p => p.user.toString() === req.user._id.toString());
      const userSplit = expense.splitBetween.find(s => s.user.toString() === req.user._id.toString());

      csvData.push({
        date: expense.date.toISOString().split('T')[0],
        group: expense.group.name,
        description: expense.description,
        category: expense.category,
        totalAmount: expense.amount,
        currency: expense.currency,
        amountPaid: userPaid ? userPaid.amount : 0,
        amountOwed: userSplit ? userSplit.amount : 0,
        createdBy: expense.createdBy.name,
        createdAt: expense.createdAt.toISOString()
      });
    }

    // Create CSV file
    const filename = `expenses_${Date.now()}.csv`;
    const filepath = path.join(__dirname, '../public/exports', filename);

    const writer = csvWriter.createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'group', title: 'Group' },
        { id: 'description', title: 'Description' },
        { id: 'category', title: 'Category' },
        { id: 'totalAmount', title: 'Total Amount' },
        { id: 'currency', title: 'Currency' },
        { id: 'amountPaid', title: 'Amount Paid' },
        { id: 'amountOwed', title: 'Amount Owed' },
        { id: 'createdBy', title: 'Created By' },
        { id: 'createdAt', title: 'Created At' }
      ]
    });

    await writer.writeRecords(csvData);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      require('fs').unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export expenses error:', error);
    res.status(500).json({ message: 'Server error while exporting expenses' });
  }
});

// @route   GET /api/users/export/balances
// @desc    Export user balances to CSV
// @access  Private
router.get('/export/balances', auth, async (req, res) => {
  try {
    const { groupId } = req.query;

    let groups;
    if (groupId) {
      groups = [await Group.findById(groupId)];
    } else {
      groups = await Group.find({
        'members.user': req.user._id,
        'members.isActive': true,
        isDeleted: false
      });
    }

    const csvData = [];
    for (const group of groups) {
      const userBalances = await Balance.getUserBalances(group._id, req.user._id);
      
      for (const balance of userBalances) {
        csvData.push({
          group: group.name,
          otherUser: balance.otherUser.name,
          otherUserEmail: balance.otherUser.email,
          amount: balance.amount,
          currency: balance.currency,
          status: balance.amount > 0 ? 'They owe you' : balance.amount < 0 ? 'You owe them' : 'Settled',
          lastUpdated: balance.lastUpdated.toISOString()
        });
      }
    }

    // Create CSV file
    const filename = `balances_${Date.now()}.csv`;
    const filepath = path.join(__dirname, '../public/exports', filename);

    const writer = csvWriter.createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'group', title: 'Group' },
        { id: 'otherUser', title: 'Other User' },
        { id: 'otherUserEmail', title: 'Other User Email' },
        { id: 'amount', title: 'Amount' },
        { id: 'currency', title: 'Currency' },
        { id: 'status', title: 'Status' },
        { id: 'lastUpdated', title: 'Last Updated' }
      ]
    });

    await writer.writeRecords(csvData);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      require('fs').unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('File cleanup error:', unlinkErr);
      });
    });
  } catch (error) {
    console.error('Export balances error:', error);
    res.status(500).json({ message: 'Server error while exporting balances' });
  }
});

module.exports = router;