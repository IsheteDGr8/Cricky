document.addEventListener("DOMContentLoaded", function () {
    // URL to your Google Sheet
    const googleSheetUrl = "https://docs.google.com/spreadsheets/d/16EJLmI_a7Idve6jglAkZyHUXReVd1FNf/gviz/tq?tqx=out:csv&sheet=Summary";

    // Fetch data from the Google Sheet
    fetch(googleSheetUrl)
        .then((response) => response.text())
        .then((data) => {
            // Parse the CSV data into an array of rows
            const rows = data.split('\n');
            
            // Create an array to hold the data
            const dataArray = [];

            for (const row of rows) {
                const rowData = row.split(',');
                if (rowData.length >= 2) {
                    const name = rowData[0].trim();
                    const points = parseFloat(rowData[1].trim()); // Convert points to a number

                    if (!isNaN(points)) {
                        dataArray.push({ name, points });
                    }
                }
            }

            // Sort the data by points in descending order
            dataArray.sort((a, b) => b.points - a.points);

            const scoresList = document.getElementById('scores-list');

            for (const item of dataArray) {
                const rowElement = document.createElement('tr');
                const nameCell = document.createElement('td');
                const pointsCell = document.createElement('td');

                nameCell.textContent = item.name;
                pointsCell.textContent = item.points;

                rowElement.appendChild(nameCell);
                rowElement.appendChild(pointsCell);

                scoresList.appendChild(rowElement);
            }
        })
        .catch((error) => {
            console.error('Error fetching data:', error);
        });
});
