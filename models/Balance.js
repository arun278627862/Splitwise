const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
balanceSchema.index({ group: 1, user1: 1, user2: 1 }, { unique: true });
balanceSchema.index({ user1: 1 });
balanceSchema.index({ user2: 1 });

// Static method to update balance between two users
balanceSchema.statics.updateBalance = async function(groupId, payerId, receiverId, amount, currency = 'USD') {
  // Ensure consistent ordering (smaller ObjectId first)
  const [user1, user2] = [payerId, receiverId].sort();
  const isReversed = user1.toString() !== payerId.toString();
  const balanceAmount = isReversed ? -amount : amount;
  
  const filter = { group: groupId, user1, user2 };
  const update = {
    $inc: { amount: balanceAmount },
    currency,
    lastUpdated: new Date()
  };
  
  const options = { upsert: true, new: true };
  
  return this.findOneAndUpdate(filter, update, options);
};

// Static method to get all balances for a user in a group
balanceSchema.statics.getUserBalances = async function(groupId, userId) {
  const balances = await this.find({
    group: groupId,
    $or: [
      { user1: userId },
      { user2: userId }
    ]
  }).populate('user1 user2', 'name email avatar');
  
  return balances.map(balance => {
    const isUser1 = balance.user1._id.toString() === userId.toString();
    return {
      id: balance._id,
      otherUser: isUser1 ? balance.user2 : balance.user1,
      amount: isUser1 ? balance.amount : -balance.amount,
      currency: balance.currency,
      lastUpdated: balance.lastUpdated
    };
  });
};

// Static method to get simplified balances (debt consolidation)
balanceSchema.statics.getSimplifiedBalances = async function(groupId) {
  const balances = await this.find({ group: groupId })
    .populate('user1 user2', 'name email avatar');
  
  // Build a map of net balances for each user
  const netBalances = new Map();
  
  balances.forEach(balance => {
    const user1Id = balance.user1._id.toString();
    const user2Id = balance.user2._id.toString();
    
    if (!netBalances.has(user1Id)) {
      netBalances.set(user1Id, { user: balance.user1, amount: 0 });
    }
    if (!netBalances.has(user2Id)) {
      netBalances.set(user2Id, { user: balance.user2, amount: 0 });
    }
    
    netBalances.get(user1Id).amount += balance.amount;
    netBalances.get(user2Id).amount -= balance.amount;
  });
  
  // Separate creditors and debtors
  const creditors = [];
  const debtors = [];
  
  netBalances.forEach((balance, userId) => {
    if (balance.amount > 0.01) {
      creditors.push({ ...balance, amount: Math.round(balance.amount * 100) / 100 });
    } else if (balance.amount < -0.01) {
      debtors.push({ ...balance, amount: Math.round(-balance.amount * 100) / 100 });
    }
  });
  
  // Calculate minimum transactions to settle all debts
  const transactions = [];
  const creditorsCopy = [...creditors];
  const debtorsCopy = [...debtors];
  
  while (creditorsCopy.length > 0 && debtorsCopy.length > 0) {
    const creditor = creditorsCopy[0];
    const debtor = debtorsCopy[0];
    
    const settleAmount = Math.min(creditor.amount, debtor.amount);
    
    transactions.push({
      from: debtor.user,
      to: creditor.user,
      amount: settleAmount,
      currency: balances[0]?.currency || 'USD'
    });
    
    creditor.amount -= settleAmount;
    debtor.amount -= settleAmount;
    
    if (creditor.amount <= 0.01) {
      creditorsCopy.shift();
    }
    if (debtor.amount <= 0.01) {
      debtorsCopy.shift();
    }
  }
  
  return transactions;
};

// Static method to recalculate all balances for a group
balanceSchema.statics.recalculateGroupBalances = async function(groupId) {
  // Clear existing balances
  await this.deleteMany({ group: groupId });
  
  // Get all expenses for the group
  const Expense = mongoose.model('Expense');
  const expenses = await Expense.find({
    group: groupId,
    isDeleted: false,
    status: 'approved'
  });
  
  // Recalculate balances from expenses
  for (const expense of expenses) {
    // For each person who paid
    for (const payment of expense.paidBy) {
      // For each person who owes
      for (const split of expense.splitBetween) {
        if (payment.user.toString() !== split.user.toString()) {
          await this.updateBalance(
            groupId,
            payment.user,
            split.user,
            split.amount * (payment.amount / expense.amount),
            expense.currency
          );
        }
      }
    }
  }
};

module.exports = mongoose.model('Balance', balanceSchema);