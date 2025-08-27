const cron = require('node-cron');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const Balance = require('../models/Balance');
const Notification = require('../models/Notification');

class RecurringExpenseService {
  constructor() {
    this.jobs = new Map();
    this.initializeCronJob();
  }

  initializeCronJob() {
    // Run every day at 9:00 AM to check for due recurring expenses
    cron.schedule('0 9 * * *', async () => {
      console.log('Checking for due recurring expenses...');
      await this.processRecurringExpenses();
    });

    console.log('Recurring expense service initialized');
  }

  async processRecurringExpenses() {
    try {
      const now = new Date();
      
      // Find expenses due for recurrence
      const dueExpenses = await Expense.find({
        isRecurring: true,
        isDeleted: false,
        'recurringDetails.nextOccurrence': { $lte: now }
      }).populate('group').populate('createdBy');

      console.log(`Found ${dueExpenses.length} recurring expenses due for processing`);

      for (const expense of dueExpenses) {
        await this.createRecurringExpense(expense);
      }
    } catch (error) {
      console.error('Error processing recurring expenses:', error);
    }
  }

  async createRecurringExpense(originalExpense) {
    try {
      // Check if the group still exists and is active
      const group = await Group.findOne({
        _id: originalExpense.group._id,
        isDeleted: false
      });

      if (!group) {
        console.log(`Group ${originalExpense.group._id} no longer exists, canceling recurring expense`);
        await this.cancelRecurringExpense(originalExpense._id);
        return;
      }

      // Create new expense based on the original
      const newExpense = new Expense({
        description: originalExpense.description,
        amount: originalExpense.amount,
        currency: originalExpense.currency,
        category: originalExpense.category,
        date: new Date(),
        group: originalExpense.group._id,
        paidBy: originalExpense.paidBy,
        splitBetween: originalExpense.splitBetween,
        splitType: originalExpense.splitType,
        notes: originalExpense.notes + ' (Auto-generated recurring expense)',
        tags: originalExpense.tags,
        createdBy: originalExpense.createdBy._id,
        isRecurring: false, // New expense is not recurring itself
        recurringDetails: {
          parentExpense: originalExpense._id
        }
      });

      // Calculate split amounts
      if (newExpense.splitType === 'equal') {
        newExpense.calculateEqualSplit();
      } else if (newExpense.splitType === 'percentage') {
        newExpense.calculatePercentageSplit();
      }

      await newExpense.save();

      // Update balances
      for (const payment of newExpense.paidBy) {
        for (const split of newExpense.splitBetween) {
          if (payment.user.toString() !== split.user.toString()) {
            await Balance.updateBalance(
              newExpense.group,
              payment.user,
              split.user,
              split.amount * (payment.amount / newExpense.amount),
              newExpense.currency
            );
          }
        }
      }

      // Calculate next occurrence
      const nextOccurrence = this.calculateNextOccurrence(
        originalExpense.recurringDetails.nextOccurrence,
        originalExpense.recurringDetails.frequency,
        originalExpense.recurringDetails.interval
      );

      // Check if we should continue the recurrence
      if (originalExpense.recurringDetails.endDate && nextOccurrence > originalExpense.recurringDetails.endDate) {
        console.log(`Recurring expense ${originalExpense._id} has reached its end date`);
        await this.cancelRecurringExpense(originalExpense._id);
      } else {
        // Update next occurrence
        originalExpense.recurringDetails.nextOccurrence = nextOccurrence;
        await originalExpense.save();
      }

      // Create notifications for involved users
      const involvedUsers = new Set();
      newExpense.paidBy.forEach(p => involvedUsers.add(p.user.toString()));
      newExpense.splitBetween.forEach(s => involvedUsers.add(s.user.toString()));

      for (const userId of involvedUsers) {
        await Notification.createAndSend({
          recipient: userId,
          sender: originalExpense.createdBy._id,
          type: 'expense_added',
          title: 'Recurring expense added',
          message: `Recurring expense "${newExpense.description}" was automatically added to ${group.name}`,
          data: {
            expenseId: newExpense._id,
            groupId: group._id,
            amount: newExpense.amount,
            currency: newExpense.currency
          }
        });
      }

      console.log(`Created recurring expense: ${newExpense.description} for group ${group.name}`);

    } catch (error) {
      console.error(`Error creating recurring expense for ${originalExpense._id}:`, error);
    }
  }

  calculateNextOccurrence(currentDate, frequency, interval = 1) {
    const nextDate = new Date(currentDate);

    switch (frequency) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * interval));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
      default:
        throw new Error(`Unknown frequency: ${frequency}`);
    }

    return nextDate;
  }

  async scheduleRecurringExpense(expense) {
    try {
      if (!expense.isRecurring || !expense.recurringDetails) {
        throw new Error('Expense is not configured for recurrence');
      }

      const { frequency, interval = 1, endDate } = expense.recurringDetails;

      // Calculate first occurrence
      const nextOccurrence = this.calculateNextOccurrence(
        expense.date,
        frequency,
        interval
      );

      // Update the expense with next occurrence
      expense.recurringDetails.nextOccurrence = nextOccurrence;
      await expense.save();

      console.log(`Scheduled recurring expense: ${expense.description}, next occurrence: ${nextOccurrence}`);

      return expense;
    } catch (error) {
      console.error('Error scheduling recurring expense:', error);
      throw error;
    }
  }

  async cancelRecurringExpense(expenseId) {
    try {
      await Expense.findByIdAndUpdate(expenseId, {
        isRecurring: false,
        'recurringDetails.nextOccurrence': null
      });

      console.log(`Canceled recurring expense: ${expenseId}`);
    } catch (error) {
      console.error('Error canceling recurring expense:', error);
      throw error;
    }
  }

  async updateRecurringExpense(expenseId, updateData) {
    try {
      const expense = await Expense.findById(expenseId);
      
      if (!expense || !expense.isRecurring) {
        throw new Error('Expense not found or not recurring');
      }

      // Update the recurring expense
      Object.assign(expense, updateData);

      // If frequency or interval changed, recalculate next occurrence
      if (updateData.recurringDetails) {
        const { frequency, interval } = expense.recurringDetails;
        expense.recurringDetails.nextOccurrence = this.calculateNextOccurrence(
          expense.recurringDetails.nextOccurrence,
          frequency,
          interval
        );
      }

      await expense.save();

      console.log(`Updated recurring expense: ${expenseId}`);
      return expense;
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      throw error;
    }
  }

  async getRecurringExpenses(groupId) {
    try {
      const recurringExpenses = await Expense.find({
        group: groupId,
        isRecurring: true,
        isDeleted: false
      })
      .populate('createdBy', 'name email')
      .populate('paidBy.user', 'name email')
      .populate('splitBetween.user', 'name email')
      .sort({ 'recurringDetails.nextOccurrence': 1 });

      return recurringExpenses;
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      throw error;
    }
  }

  // Method to get upcoming recurring expenses for a user
  async getUpcomingRecurringExpenses(userId, days = 7) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const upcomingExpenses = await Expense.find({
        isRecurring: true,
        isDeleted: false,
        $or: [
          { 'paidBy.user': userId },
          { 'splitBetween.user': userId }
        ],
        'recurringDetails.nextOccurrence': {
          $gte: new Date(),
          $lte: futureDate
        }
      })
      .populate('group', 'name')
      .populate('createdBy', 'name')
      .sort({ 'recurringDetails.nextOccurrence': 1 });

      return upcomingExpenses;
    } catch (error) {
      console.error('Error fetching upcoming recurring expenses:', error);
      throw error;
    }
  }
}

module.exports = new RecurringExpenseService();