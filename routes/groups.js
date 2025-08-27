const express = require('express');
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Balance = require('../models/Balance');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/groups
// @desc    Get all groups for authenticated user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({
      'members.user': req.user._id,
      'members.isActive': true,
      isDeleted: false
    })
    .populate('members.user', 'name email avatar')
    .populate('createdBy', 'name email')
    .sort({ updatedAt: -1 });

    res.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ message: 'Server error while fetching groups' });
  }
});

// @route   POST /api/groups
// @desc    Create a new group
// @access  Private
router.post('/', [
  auth,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Group name is required and must be less than 100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('type').optional().isIn(['trip', 'home', 'couple', 'other']).withMessage('Invalid group type'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { name, description, type, currency } = req.body;

    const group = new Group({
      name,
      description,
      type: type || 'other',
      currency: currency || req.user.defaultCurrency || 'USD',
      members: [{
        user: req.user._id,
        role: 'admin',
        joinedAt: new Date(),
        isActive: true
      }],
      createdBy: req.user._id
    });

    // Generate invite code
    group.generateInviteCode();

    await group.save();

    // Add group to user's groups
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { groups: group._id }
    });

    await group.populate('members.user', 'name email avatar');
    await group.populate('createdBy', 'name email');

    // Emit socket event
    const io = req.app.get('io');
    io.to(`user_${req.user._id}`).emit('group_created', { group });

    res.status(201).json({
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error while creating group' });
  }
});

// @route   GET /api/groups/:id
// @desc    Get group details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      'members.user': req.user._id,
      'members.isActive': true,
      isDeleted: false
    })
    .populate('members.user', 'name email avatar phone')
    .populate('createdBy', 'name email');

    if (!group) {
      return res.status(404).json({ message: 'Group not found or access denied' });
    }

    // Get recent expenses
    const recentExpenses = await Expense.find({
      group: group._id,
      isDeleted: false
    })
    .populate('createdBy', 'name email avatar')
    .populate('paidBy.user', 'name email')
    .populate('splitBetween.user', 'name email')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get balances
    const balances = await Balance.getUserBalances(group._id, req.user._id);

    res.json({
      group,
      recentExpenses,
      balances
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ message: 'Server error while fetching group' });
  }
});

// @route   PUT /api/groups/:id
// @desc    Update group details
// @access  Private
router.put('/:id', [
  auth,
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Group name must be less than 100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('type').optional().isIn(['trip', 'home', 'couple', 'other']).withMessage('Invalid group type'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const group = await Group.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: 'Only group admins can update group details' });
    }

    const { name, description, type, currency, settings } = req.body;

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (type) group.type = type;
    if (currency) group.currency = currency;
    if (settings) group.settings = { ...group.settings, ...settings };

    await group.save();
    await group.populate('members.user', 'name email avatar');

    // Emit socket event to all group members
    const io = req.app.get('io');
    io.to(`group_${group._id}`).emit('group_updated', { group });

    res.json({
      message: 'Group updated successfully',
      group
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Server error while updating group' });
  }
});

// @route   POST /api/groups/:id/join
// @desc    Join group using invite code
// @access  Private
router.post('/join', [
  auth,
  body('inviteCode').trim().isLength({ min: 1 }).withMessage('Invite code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const { inviteCode } = req.body;

    const group = await Group.findOne({
      inviteCode: inviteCode.toUpperCase(),
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    // Check if user is already a member
    if (group.isMember(req.user._id)) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Add user to group
    group.members.push({
      user: req.user._id,
      role: 'member',
      joinedAt: new Date(),
      isActive: true
    });

    await group.save();

    // Add group to user's groups
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { groups: group._id }
    });

    await group.populate('members.user', 'name email avatar');

    // Create notification for other group members
    const activeMembers = group.getActiveMembers();
    for (const member of activeMembers) {
      if (member.user.toString() !== req.user._id.toString()) {
        await Notification.createAndSend({
          recipient: member.user,
          sender: req.user._id,
          type: 'group_joined',
          title: 'New member joined',
          message: `${req.user.name} joined the group "${group.name}"`,
          data: {
            groupId: group._id
          }
        });
      }
    }

    // Emit socket events
    const io = req.app.get('io');
    io.to(`group_${group._id}`).emit('member_joined', {
      group,
      newMember: req.user
    });

    res.json({
      message: 'Successfully joined the group',
      group
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ message: 'Server error while joining group' });
  }
});

// @route   POST /api/groups/:id/invite
// @desc    Invite user to group by email
// @access  Private
router.post('/:id/invite', [
  auth,
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const group = await Group.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member and has permission to invite
    if (!group.isMember(req.user._id)) {
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    if (!group.settings.allowMemberInvites && !group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: 'Only admins can invite new members' });
    }

    const { email } = req.body;

    // Check if user exists
    const invitedUser = await User.findOne({ email });
    if (invitedUser) {
      // Check if already a member
      if (group.isMember(invitedUser._id)) {
        return res.status(400).json({ message: 'User is already a member of this group' });
      }

      // Send notification to existing user
      await Notification.createAndSend({
        recipient: invitedUser._id,
        sender: req.user._id,
        type: 'group_invite',
        title: 'Group invitation',
        message: `${req.user.name} invited you to join "${group.name}"`,
        data: {
          groupId: group._id
        }
      });
    }

    // Send email invitation
    const emailService = require('../services/emailService');
    try {
      await emailService.sendGroupInvitation(email, group, req.user);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
    }

    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ message: 'Server error while sending invitation' });
  }
});

// @route   POST /api/groups/:id/leave
// @desc    Leave group
// @access  Private
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member
    if (!group.isMember(req.user._id)) {
      return res.status(400).json({ message: 'You are not a member of this group' });
    }

    // Check if user has pending balances
    const userBalances = await Balance.getUserBalances(group._id, req.user._id);
    const hasBalance = userBalances.some(balance => Math.abs(balance.amount) > 0.01);

    if (hasBalance) {
      return res.status(400).json({ 
        message: 'You cannot leave the group while you have pending balances. Please settle all debts first.',
        balances: userBalances
      });
    }

    // Remove user from group
    const memberIndex = group.members.findIndex(
      member => member.user.toString() === req.user._id.toString()
    );

    if (memberIndex !== -1) {
      group.members[memberIndex].isActive = false;
    }

    await group.save();

    // Remove group from user's groups
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { groups: group._id }
    });

    // Create notification for other group members
    const activeMembers = group.getActiveMembers();
    for (const member of activeMembers) {
      await Notification.createAndSend({
        recipient: member.user,
        sender: req.user._id,
        type: 'group_left',
        title: 'Member left group',
        message: `${req.user.name} left the group "${group.name}"`,
        data: {
          groupId: group._id
        }
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(`group_${group._id}`).emit('member_left', {
      group,
      leftMember: req.user
    });

    res.json({ message: 'Successfully left the group' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ message: 'Server error while leaving group' });
  }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group (soft delete)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ message: 'Only group admins can delete the group' });
    }

    // Check if there are any pending balances
    const balances = await Balance.find({ group: group._id });
    const hasBalances = balances.some(balance => Math.abs(balance.amount) > 0.01);

    if (hasBalances) {
      return res.status(400).json({ 
        message: 'Cannot delete group with pending balances. Please settle all debts first.'
      });
    }

    // Soft delete the group
    group.isDeleted = true;
    group.deletedAt = new Date();
    group.deletedBy = req.user._id;
    await group.save();

    // Soft delete all expenses in the group
    await Expense.updateMany(
      { group: group._id },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id
      }
    );

    // Remove group from all users
    await User.updateMany(
      { groups: group._id },
      { $pull: { groups: group._id } }
    );

    // Emit socket event
    const io = req.app.get('io');
    io.to(`group_${group._id}`).emit('group_deleted', { group });

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Server error while deleting group' });
  }
});

// @route   GET /api/groups/:id/balances
// @desc    Get group balances and settlements
// @access  Private
router.get('/:id/balances', auth, async (req, res) => {
  try {
    const group = await Group.findOne({
      _id: req.params.id,
      'members.user': req.user._id,
      'members.isActive': true,
      isDeleted: false
    });

    if (!group) {
      return res.status(404).json({ message: 'Group not found or access denied' });
    }

    // Get user's individual balances
    const userBalances = await Balance.getUserBalances(group._id, req.user._id);

    // Get simplified balances for the entire group
    const simplifiedBalances = await Balance.getSimplifiedBalances(group._id);

    res.json({
      userBalances,
      simplifiedBalances
    });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ message: 'Server error while fetching balances' });
  }
});

module.exports = router;