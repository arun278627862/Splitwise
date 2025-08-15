document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:5000';

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
        element.className = 'message'; // reset classes
        if (message) {
            element.classList.add(isSuccess ? 'success' : 'error');
        }
    };

    // Create Group
    createGroupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(createGroupForm);
        const group_name = formData.get('group_name');
        const members = formData.get('members').split(',').map(m => m.trim());

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
                showMessage(groupMessage, result.error, false);
            }
        } catch (error) {
            showMessage(groupMessage, 'An error occurred. Is the backend server running?', false);
        }
    });

    // Add Expense
    addExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addExpenseForm);
        const group = formData.get('group');
        const payer = formData.get('payer');
        const amount = formData.get('amount');
        const split_members = formData.get('split_members').split(',').map(m => m.trim());

        try {
            const response = await fetch(`${API_URL}/add-expense`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group, payer, amount, split_members }),
            });
            const result = await response.json();
            if (response.ok) {
                showMessage(expenseMessage, result.message, true);
                addExpenseForm.reset();
            } else {
                showMessage(expenseMessage, result.error, false);
            }
        } catch (error) {
            showMessage(expenseMessage, 'An error occurred.', false);
        }
    });

    // Get Balances
    getBalancesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(getBalancesForm);
        const group = formData.get('group');

        // Clear previous results
        balancesResult.innerHTML = '';
        showMessage(balanceMessage, '', false);

        try {
            const response = await fetch(`${API_URL}/balances?group=${encodeURIComponent(group)}`);
            const result = await response.json();

            if (response.ok) {
                if (result.length === 0) {
                    balancesResult.innerHTML = '<p>All settled up in this group!</p>';
                } else {
                    const ul = document.createElement('ul');
                    result.forEach(t => {
                        const li = document.createElement('li');
                        li.textContent = `${t.from} owes ${t.to} $${t.amount.toFixed(2)}`;
                        ul.appendChild(li);
                    });
                    balancesResult.appendChild(ul);
                }
            } else {
                showMessage(balanceMessage, result.error, false);
            }
        } catch (error) {
            showMessage(balanceMessage, 'An error occurred while fetching balances.', false);
        }
    });
});
