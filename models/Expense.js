const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  convertedAmount: {
    type: Number,
    default: null
  },
  baseCurrency: {
    type: String,
    default: 'USD'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  category: {
    type: String,
    enum: ['food', 'transport', 'accommodation', 'entertainment', 'shopping', 'utilities', 'healthcare', 'other'],
    default: 'other'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  paidBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  splitBetween: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  splitType: {
    type: String,
    enum: ['equal', 'exact', 'percentage'],
    default: 'equal'
  },
  receipt: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDetails: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly'],
      default: null
    },
    interval: {
      type: Number,
      default: 1
    },
    endDate: {
      type: Date,
      default: null
    },
    nextOccurrence: {
      type: Date,
      default: null
    },
    parentExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
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
expenseSchema.index({ group: 1, date: -1 });
expenseSchema.index({ createdBy: 1 });
expenseSchema.index({ 'paidBy.user': 1 });
expenseSchema.index({ 'splitBetween.user': 1 });
expenseSchema.index({ isDeleted: 1 });
expenseSchema.index({ 'recurringDetails.nextOccurrence': 1 });

// Virtual for total paid amount
expenseSchema.virtual('totalPaid').get(function() {
  return this.paidBy.reduce((sum, payment) => sum + payment.amount, 0);
});

// Virtual for total split amount
expenseSchema.virtual('totalSplit').get(function() {
  return this.splitBetween.reduce((sum, split) => sum + split.amount, 0);
});

// Validate that total paid equals total split
expenseSchema.pre('save', function(next) {
  const totalPaid = this.totalPaid;
  const totalSplit = this.totalSplit;
  
  if (Math.abs(totalPaid - totalSplit) > 0.01) {
    return next(new Error('Total paid amount must equal total split amount'));
  }
  
  // Validate split percentages if using percentage split
  if (this.splitType === 'percentage') {
    const totalPercentage = this.splitBetween.reduce((sum, split) => sum + split.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return next(new Error('Split percentages must add up to 100%'));
    }
  }
  
  next();
});

// Method to calculate split amounts for equal split
expenseSchema.methods.calculateEqualSplit = function() {
  const memberCount = this.splitBetween.length;
  if (memberCount === 0) return;
  
  const equalAmount = this.amount / memberCount;
  this.splitBetween.forEach(split => {
    split.amount = equalAmount;
    split.percentage = 100 / memberCount;
  });
};

// Method to calculate split amounts for percentage split
expenseSchema.methods.calculatePercentageSplit = function() {
  this.splitBetween.forEach(split => {
    split.amount = (this.amount * split.percentage) / 100;
  });
};

module.exports = mongoose.model('Expense', expenseSchema);