import csv
from collections import defaultdict

def calculate_balances(group_name):
    expenses = []
    group_members = []

    with open('expenses.csv', 'r') as file:
        reader = csv.reader(file)
        header = next(reader)
        for row in reader:
            if row[0] == group_name:
                if row[1] == '_GROUP_METADATA_':
                    group_members = row[3].split(',')
                else:
                    expenses.append({
                        "payer": row[1],
                        "amount": float(row[2]),
                        "split_members": row[3].split(',')
                    })

    if not group_members:
        raise ValueError(f"Group '{group_name}' not found or has no members.")

    balances = defaultdict(float)
    for member in group_members:
        balances[member] = 0.0

    for expense in expenses:
        payer = expense['payer']
        amount = expense['amount']
        split_members = expense['split_members']

        if not split_members:
            continue

        share = amount / len(split_members)

        balances[payer] += amount
        for member in split_members:
            if member in balances:
                balances[member] -= share

    # Separate debtors and creditors
    debtors = {person: balance for person, balance in balances.items() if balance < 0}
    creditors = {person: balance for person, balance in balances.items() if balance > 0}

    transactions = []

    # Use a greedy approach to settle debts
    sorted_debtors = sorted(debtors.items(), key=lambda x: x[1])
    sorted_creditors = sorted(creditors.items(), key=lambda x: x[1], reverse=True)

    debtor_idx = 0
    creditor_idx = 0

    while debtor_idx < len(sorted_debtors) and creditor_idx < len(sorted_creditors):
        debtor, debt_amount = sorted_debtors[debtor_idx]
        creditor, credit_amount = sorted_creditors[creditor_idx]

        debt_amount = abs(debt_amount)

        payment = min(debt_amount, credit_amount)

        transactions.append({
            "from": debtor,
            "to": creditor,
            "amount": round(payment, 2)
        })

        new_debt = debt_amount - payment
        new_credit = credit_amount - payment

        if new_debt < 0.01: # Use a small epsilon for float comparison
            debtor_idx += 1
        else:
            sorted_debtors[debtor_idx] = (debtor, -new_debt)

        if new_credit < 0.01:
            creditor_idx += 1
        else:
            sorted_creditors[creditor_idx] = (creditor, new_credit)

    return transactions
