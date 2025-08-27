document.addEventListener('DOMContentLoaded', () => {
    const createGroupForm = document.getElementById('create-group-form');
    const addExpenseForm = document.getElementById('add-expense-form');
    const getBalancesForm = document.getElementById('get-balances-form');

    const groupMessage = document.getElementById('group-message');
    const expenseMessage = document.getElementById('expense-message');
    const balanceMessage = document.getElementById('balance-message');
    const balancesResult = document.getElementById('balances-result');

    // localStorage helpers
    const getGroups = () => JSON.parse(localStorage.getItem('splitwise_groups') || '{}');
    const getExpenses = () => JSON.parse(localStorage.getItem('splitwise_expenses') || '[]');
    const saveGroups = (groups) => localStorage.setItem('splitwise_groups', JSON.stringify(groups));
    const saveExpenses = (expenses) => localStorage.setItem('splitwise_expenses', JSON.stringify(expenses));

    // Initialize with demo data if no data exists
    const initializeDemoData = () => {
        const groups = getGroups();
        const expenses = getExpenses();
        
        if (Object.keys(groups).length === 0 && expenses.length === 0) {
            // Add demo group
            const demoGroups = {
                'Trip to Paris': ['Alice', 'Bob', 'Charlie']
            };
            saveGroups(demoGroups);
            
            // Add demo expenses
            const demoExpenses = [
                {
                    group: 'Trip to Paris',
                    payer: 'Alice',
                    amount: 120,
                    split_members: ['Alice', 'Bob', 'Charlie'],
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    group: 'Trip to Paris',
                    payer: 'Bob',
                    amount: 60,
                    split_members: ['Bob', 'Charlie'],
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                }
            ];
            saveExpenses(demoExpenses);
            
            // Show welcome message
            showMessage(groupMessage, 'Welcome! Demo data has been loaded. Try "Trip to Paris" group.', true);
        }
    };

    // Initialize demo data on first load
    initializeDemoData();

    // Helper to display messages
    const showMessage = (element, message, isSuccess) => {
        element.textContent = message;
        element.className = 'message'; // reset classes
        if (message) {
            element.classList.add(isSuccess ? 'success' : 'error');
        }
    };

    // Balance calculation function
    const calculateBalances = (groupName) => {
        const expenses = getExpenses().filter(expense => expense.group === groupName);
        const groups = getGroups();
        
        if (!groups[groupName]) {
            throw new Error('Group not found');
        }

        const members = groups[groupName];
        const balances = {};
        
        // Initialize balances
        members.forEach(member => {
            balances[member] = 0;
        });

        // Calculate balances from expenses
        expenses.forEach(expense => {
            const amount = parseFloat(expense.amount);
            const splitMembers = expense.split_members;
            const sharePerPerson = amount / splitMembers.length;

            // Payer gets credited
            balances[expense.payer] += amount;

            // Each split member gets debited
            splitMembers.forEach(member => {
                balances[member] -= sharePerPerson;
            });
        });

        return balances;
    };

    // Create Group
    createGroupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(createGroupForm);
        const group_name = formData.get('group_name');
        const members = formData.get('members').split(',').map(m => m.trim()).filter(m => m);

        try {
            if (!group_name || members.length === 0) {
                showMessage(groupMessage, 'Group name and members are required', false);
                return;
            }

            const groups = getGroups();
            
            if (groups[group_name]) {
                showMessage(groupMessage, 'Group already exists', false);
                return;
            }

            groups[group_name] = members;
            saveGroups(groups);

            showMessage(groupMessage, `Group '${group_name}' created successfully`, true);
            createGroupForm.reset();
        } catch (error) {
            showMessage(groupMessage, 'An error occurred while creating the group', false);
        }
    });

    // Add Expense
    addExpenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(addExpenseForm);
        const group = formData.get('group');
        const payer = formData.get('payer');
        const amount = formData.get('amount');
        const split_members = formData.get('split_members').split(',').map(m => m.trim()).filter(m => m);

        try {
            if (!group || !payer || !amount || split_members.length === 0) {
                showMessage(expenseMessage, 'All fields are required', false);
                return;
            }

            const groups = getGroups();
            if (!groups[group]) {
                showMessage(expenseMessage, 'Group does not exist. Please create the group first.', false);
                return;
            }

            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                showMessage(expenseMessage, 'Please enter a valid amount', false);
                return;
            }

            // Validate that payer and split members exist in the group
            const groupMembers = groups[group];
            if (!groupMembers.includes(payer)) {
                showMessage(expenseMessage, 'Payer must be a member of the group', false);
                return;
            }

            const invalidMembers = split_members.filter(member => !groupMembers.includes(member));
            if (invalidMembers.length > 0) {
                showMessage(expenseMessage, `Invalid members: ${invalidMembers.join(', ')}`, false);
                return;
            }

            const expenses = getExpenses();
            expenses.push({
                group,
                payer,
                amount: numAmount,
                split_members,
                timestamp: new Date().toISOString()
            });
            saveExpenses(expenses);

            showMessage(expenseMessage, 'Expense added successfully', true);
            addExpenseForm.reset();
        } catch (error) {
            showMessage(expenseMessage, 'An error occurred while adding the expense', false);
        }
    });

    // Get Balances
    getBalancesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(getBalancesForm);
        const group = formData.get('group');

        // Clear previous results
        balancesResult.innerHTML = '';
        showMessage(balanceMessage, '', false);

        try {
            if (!group) {
                showMessage(balanceMessage, 'Group name is required', false);
                return;
            }

            const groups = getGroups();
            if (!groups[group]) {
                showMessage(balanceMessage, 'Group not found', false);
                return;
            }

            const balances = calculateBalances(group);
            
            // Calculate who owes whom (simplified debt calculation)
            const transactions = [];
            const creditors = [];
            const debtors = [];

            Object.entries(balances).forEach(([person, balance]) => {
                if (balance > 0.01) {
                    creditors.push({ person, amount: balance });
                } else if (balance < -0.01) {
                    debtors.push({ person, amount: -balance });
                }
            });

            // Simple debt settlement algorithm
            let i = 0, j = 0;
            while (i < creditors.length && j < debtors.length) {
                const creditor = creditors[i];
                const debtor = debtors[j];
                const settleAmount = Math.min(creditor.amount, debtor.amount);

                if (settleAmount > 0.01) {
                    transactions.push({
                        from: debtor.person,
                        to: creditor.person,
                        amount: settleAmount
                    });
                }

                creditor.amount -= settleAmount;
                debtor.amount -= settleAmount;

                if (creditor.amount < 0.01) i++;
                if (debtor.amount < 0.01) j++;
            }

            if (transactions.length === 0) {
                balancesResult.innerHTML = '<p>All settled up in this group!</p>';
            } else {
                const ul = document.createElement('ul');
                transactions.forEach(t => {
                    const li = document.createElement('li');
                    li.textContent = `${t.from} owes ${t.to} $${t.amount.toFixed(2)}`;
                    ul.appendChild(li);
                });
                balancesResult.appendChild(ul);
            }

        } catch (error) {
            showMessage(balanceMessage, error.message || 'An error occurred while calculating balances', false);
        }
    });
});
