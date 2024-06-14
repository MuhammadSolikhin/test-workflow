async function predict() {
    try {
        const usersSnapshot = await db.collection('users').get();
        let totalExpenses = 0;
        let totalIncome = 0;

        for (const userDoc of usersSnapshot.docs) {
            const transactionsSnapshot = await userDoc.ref.collection('transactions').get();
            transactionsSnapshot.forEach(transactionDoc => {
                const transaction = transactionDoc.data();
                totalExpenses += transaction.expense || 0;
                totalIncome += transaction.income || 0;
            });
        }

        // Prepare input data for the model
        const inputData = [totalExpenses, totalIncome];
        const inputTensor = tf.tensor2d([inputData], [1, inputData.length]);

        // Use the model for prediction
        const prediction = model.predict(inputTensor);
        const predictionValue = prediction.dataSync()[0];

        // Determine financial stability based on the prediction
        const isStable = predictionValue > 0.5; // Adjust threshold as needed

        return { stable: isStable, prediction: predictionValue };
    } catch (error) {
        console.error('Prediction error:', error);
        return h.response('Failed to make prediction').code(500);
    }

}

export default predict;