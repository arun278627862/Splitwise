document.addEventListener('DOMContentLoaded', () => {
    // Optional backend override via query params (?api=https://your-backend)
    const urlParams = new URLSearchParams(window.location.search);
    const apiOverride = (urlParams.get('api') || urlParams.get('backend') || '').trim();
    const API_URL = apiOverride ? apiOverride.replace(/\/$/, '') : null;

    const createGroupForm = document.getElementById('create-group-form');
    const addExpenseForm = document.getElementById('add-expense-form');
    const getBalancesForm = document.getElementById('get-balances-form');

    const groupMessage = document.getElementById('group-message');
    const expenseMessage = document.getElementById('expense-message');
    const balanceMessage = document.getElementById('balance-message');
    const balancesResult = document.getElementById('balances-result');

    // Helper to display messages
    const showMessage = (element, message, isSuccess) => {
        element.textContent = message;
        element.className = 'message';
        if (message) {
            element.classList.add(isSuccess ? 'success' : 'error');
        }
    };

    // Local storage helpers for client-side mode
    const STORAGE_KEY = 'expenseTrackerData';
    const initialData = { groups: {} };

    const loadData = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : { ...initialData };
        } catch (e) {
            return { ...initialData };
        }
    };

    const saveData = (data) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };

    // Balance calculation (ported from utils.py)
    const calculateBalances = (groupName) => {
        const data = loadData();
        const group = data.groups[groupName];
        if (!group) {
            throw new Error(`Group '${groupName}' not found or has no members.`);
        }

        const groupMembers = Array.isArray(group.members) ? group.members : [];
        if (groupMembers.length === 0) {
            throw new Error(`Group '${groupName}' not found or has no members.`);
        }

        const expenses = Array.isArray(group.expenses) ? group.expenses : [];

        const balances = {};
        groupMembers.forEach((m) => { balances[m] = 0; });

        expenses.forEach((expense) => {
            const payer = expense.payer;
            const amount = Number(expense.amount) || 0;
            const splitMembers = Array.isArray(expense.split_members) ? expense.split_members : [];
            if (splitMembers.length === 0) return;
            const share = amount / splitMembers.length;
            if (balances[payer] === undefined) return;
            balances[payer] += amount;
            splitMembers.forEach((member) => {
                if (balances[member] !== undefined) {
                    balances[member] -= share;
                }
            });
        });

        const debtors = Object.entries(balances).filter(([, v]) => v < 0);
        const creditors = Object.entries(balances).filter(([, v]) => v > 0);

        const sortedDebtors = debtors.sort((a, b) => a[1] - b[1]);
        const sortedCreditors = creditors.sort((a, b) => b[1] - a[1]);

        const transactions = [];
        let debtorIdx = 0;
        let creditorIdx = 0;

        while (debtorIdx < sortedDebtors.length && creditorIdx < sortedCreditors.length) {
            const [debtor, debtAmountRaw] = sortedDebtors[debtorIdx];
            const [creditor, creditAmount] = sortedCreditors[creditorIdx];
            const debtAmount = Math.abs(debtAmountRaw);
            const payment = Math.min(debtAmount, creditAmount);

            transactions.push({ from: debtor, to: creditor, amount: Number(payment.toFixed(2)) });

            const newDebt = debtAmount - payment;
            const newCredit = creditAmount - payment;

            if (newDebt < 0.01) {
                debtorIdx += 1;
            } else {
                sortedDebtors[debtorIdx] = [debtor, -newDebt];
            }

            if (newCredit < 0.01) {
                creditorIdx += 1;
            } else {
                sortedCreditors[creditorIdx] = [creditor, newCredit];
            }
        }

        return transactions;
    };

    const usingBackend = () => Boolean(API_URL);

    // Create Group
    createGroupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(createGroupForm);
        const group_name = (formData.get('group_name') || '').trim();
        const members = (formData.get('members') || '')
            .split(',')
            .map(m => m.trim())
            .filter(m => m);

        if (!group_name || members.length === 0) {
            showMessage(groupMessage, 'Group name and at least one member are required.', false);
            return;
        }

        if (usingBackend()) {
            try {
                const response = await fetch(`${API_URL}/create-group`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group_name, members }),
                });
                const result = await response.json();
                if (response.ok) {
                    showMessage(groupMessage, result.message, true);
                    createGroupForm.reset();
                } else {
                    showMessage(groupMessage, result.error || 'Failed to create group.', false);
                }
            } catch (error) {
                showMessage(groupMessage, 'An error occurred. Is the backend server reachable?', false);
            }
            return;
        }

        // Client-side mode
        const data = loadData();
        if (data.groups[group_name]) {
            showMessage(groupMessage, 'Group already exists.', false);
            return;
        }
        data.groups[group_name] = { members, expenses: [] };
        saveData(data);
        showMessage(groupMessage, `Group '${group_name}' created successfully`, true);
        createGroupForm.reset();
    });

    // Add Expense
    addExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addExpenseForm);
        const group = (formData.get('group') || '').trim();
        const payer = (formData.get('payer') || '').trim();
        const amount = Number(formData.get('amount'));
        const split_members = (formData.get('split_members') || '')
            .split(',')
            .map(m => m.trim())
            .filter(m => m);

        if (!group || !payer || !amount || split_members.length === 0) {
            showMessage(expenseMessage, 'Missing data for expense.', false);
            return;
        }

        if (usingBackend()) {
            try {
                const response = await fetch(`${API_URL}/add-expense`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ group, payer, amount, split_members }),
                });
                const result = await response.json();
                if (response.ok) {
                    showMessage(expenseMessage, result.message || 'Expense added successfully', true);
                    addExpenseForm.reset();
                } else {
                    showMessage(expenseMessage, result.error || 'Failed to add expense.', false);
                }
            } catch (error) {
                showMessage(expenseMessage, 'An error occurred while adding expense.', false);
            }
            return;
        }

        // Client-side mode
        const data = loadData();
        if (!data.groups[group]) {
            showMessage(expenseMessage, `Group '${group}' does not exist.`, false);
            return;
        }
        data.groups[group].expenses.push({ payer, amount, split_members });
        saveData(data);
        showMessage(expenseMessage, 'Expense added successfully', true);
        addExpenseForm.reset();
    });

    // Get Balances
    getBalancesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(getBalancesForm);
        const group = (formData.get('group') || '').trim();

        // Clear previous results
        balancesResult.innerHTML = '';
        showMessage(balanceMessage, '', false);

        if (!group) {
            showMessage(balanceMessage, 'Group name is required.', false);
            return;
        }

        if (usingBackend()) {
            try {
                const response = await fetch(`${API_URL}/balances?group=${encodeURIComponent(group)}`);
                const result = await response.json();
                if (response.ok) {
                    if (Array.isArray(result) && result.length === 0) {
                        balancesResult.innerHTML = '<p>All settled up in this group!</p>';
                    } else if (Array.isArray(result)) {
                        const ul = document.createElement('ul');
                        result.forEach(t => {
                            const li = document.createElement('li');
                            li.textContent = `${t.from} owes ${t.to} $${Number(t.amount).toFixed(2)}`;
                            ul.appendChild(li);
                        });
                        balancesResult.appendChild(ul);
                    } else {
                        showMessage(balanceMessage, 'Unexpected response from server.', false);
                    }
                } else {
                    showMessage(balanceMessage, result.error || 'Failed to fetch balances.', false);
                }
            } catch (error) {
                showMessage(balanceMessage, 'An error occurred while fetching balances.', false);
            }
            return;
        }

        // Client-side mode
        try {
            const txns = calculateBalances(group);
            if (txns.length === 0) {
                balancesResult.innerHTML = '<p>All settled up in this group!</p>';
                return;
            }
            const ul = document.createElement('ul');
            txns.forEach(t => {
                const li = document.createElement('li');
                li.textContent = `${t.from} owes ${t.to} $${Number(t.amount).toFixed(2)}`;
                ul.appendChild(li);
            });
            balancesResult.appendChild(ul);
        } catch (err) {
            showMessage(balanceMessage, err.message || 'Failed to calculate balances.', false);
        }
    });
});
