import os
import csv
from flask import Flask, request, jsonify
from flask_cors import CORS
from utils import calculate_balances

app = Flask(__name__)
CORS(app)

EXPENSES_FILE = 'expenses.csv'

# Create expenses.csv if it doesn't exist
if not os.path.exists(EXPENSES_FILE):
    with open(EXPENSES_FILE, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(["group", "payer", "amount", "split_members"])

@app.route('/create-group', methods=['POST'])
def create_group():
    data = request.json
    group_name = data.get('group_name')
    members = data.get('members')

    if not group_name or not members:
        return jsonify({"error": "Group name and members are required"}), 400

    with open(EXPENSES_FILE, 'a', newline='') as file:
        writer = csv.writer(file)
        # Use a special row to store group members
        writer.writerow([group_name, '_GROUP_METADATA_', 0, ','.join(members)])

    return jsonify({"message": f"Group '{group_name}' created successfully"}), 201

@app.route('/add-expense', methods=['POST'])
def add_expense():
    data = request.json
    group = data.get('group')
    payer = data.get('payer')
    amount = data.get('amount')
    split_members = data.get('split_members')

    if not all([group, payer, amount, split_members]):
        return jsonify({"error": "Missing data for expense"}), 400

    try:
        amount = float(amount)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400

    with open(EXPENSES_FILE, 'a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([group, payer, amount, ','.join(split_members)])

    return jsonify({"message": "Expense added successfully"}), 201

@app.route('/balances', methods=['GET'])
def get_balances():
    group = request.args.get('group')
    if not group:
        return jsonify({"error": "Group name is required"}), 400

    try:
        balances = calculate_balances(group)
        return jsonify(balances)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
