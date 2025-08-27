const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  avatar: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: ['trip', 'home', 'couple', 'other'],
    default: 'other'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true
    },
    autoApproveExpenses: {
      type: Boolean,
      default: true
    },
    requireReceiptForExpenses: {
      type: Boolean,
      default: false
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
groupSchema.index({ members: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ isDeleted: 1 });

// Generate unique invite code
groupSchema.methods.generateInviteCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  this.inviteCode = result;
  return result;
};

// Get active members
groupSchema.methods.getActiveMembers = function() {
  return this.members.filter(member => member.isActive);
};

// Check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  return member && member.role === 'admin';
};

// Check if user is member
groupSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString() && m.isActive);
};

module.exports = mongoose.model('Group', groupSchema);