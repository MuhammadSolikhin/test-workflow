// loadModel.js
import * as tf from '@tensorflow/tfjs-node';
import axios from 'axios';

async function loadModel() {
    try {
        const response = await axios.get(process.env.MODEL_URL);
        const modelJson = response.data;
        const model = await tf.models.modelFromJSON(modelJson);
        return model;
    } catch (error) {
        console.error('Error loading model:', error);
        throw new Error('Failed to load model');
    }
}

export default loadModel;
