let expenses = JSON.parse(localStorage.getItem('budgetData')) || [];

const ctx = document.getElementById('myChart').getContext('2d');
let myChart = new Chart(ctx, {
    type: 'pie',
    data: {
        labels: expenses.map(e => e.label),
        datasets: [{ data: expenses.map(e => e.amount), backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'] }]
    }
});

function addExpense() {
    const label = document.getElementById('label').value;
    const amount = document.getElementById('amount').value;
    
    if(label && amount) {
        expenses.push({ label, amount: parseFloat(amount) });
        localStorage.setItem('budgetData', JSON.stringify(expenses));
        location.reload(); // Actualise pour mettre à jour le graphique
    }
}
