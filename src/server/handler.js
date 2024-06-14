import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    getFirestore,
    Timestamp,
    collection,
    setDoc,
    doc,
    getDoc,
    query,
    getDocs,
    deleteDoc,
    addDoc,
    updateDoc
} from 'firebase/firestore';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const serviceAccount = JSON.parse(Buffer.from(process.env.CLOUD_STORAGE_SERVICE_ACCOUNT, 'base64').toString('ascii'));

const storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
    },
});

const firebaseAdminConfig = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('ascii'));
admin.initializeApp({
    credential: admin.credential.cert(firebaseAdminConfig),
    databaseURL: "https://capstone-424513.firebaseio.com"
});

const firebaseConfig = {
    apiKey: "AIzaSyDPFz9k-SxQH2DApVjTdQ-WtB15fmd4rH4",
    authDomain: "capstone-424513.firebaseapp.com",
    projectId: "capstone-424513",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const initFirebase = () => {
    return { auth, firestore, googleProvider, storage };
};

export const verifyToken = async (request, h) => {
    const idToken = request.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return h.response({ error: true, message: 'Authorization token not provided' }).code(401);
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        request.user = decodedToken;
        return h.continue;
    } catch (error) {
        console.error('Token verification error:', error);

        if (error.code === 'auth/id-token-expired') {
            return h.response({ error: true, message: 'Token expired. Please log in again.' }).code(401);
        }

        return h.response({ error: true, message: 'Invalid or expired token' }).code(401);
    }
};

export const register = async (request, h) => {
    try {
        const { email, password, name } = request.payload;

        console.log('Received payload:', { email, password, name });

        if (!name || name.trim().length < 3) {
            return h.response({
                error: true,
                message: 'Invalid name. Please provide a name with at least 3 characters.'
            }).code(400);
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userId = userCredential.user.uid;
        const userData = {
            uid: userId,
            email: email,
            name: name.trim()
        };

        const userRef = doc(firestore, 'users', userId);
        await setDoc(userRef, userData);

        return h.response({ error: false, message: 'Registration successful', data: userData }).code(201);
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            return h.response({ error: true, message: 'Email is already in use. Please use a different email.' }).code(400);
        } else {
            console.error(error);
            return h.response({ error: true, message: 'Registration failed, ' + error.message }).code(400);
        }
    }
};

export const loginGoogle = async (request, h) => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const userCredential = result.user;
        const userData = {
            uid: userCredential.uid,
            email: userCredential.email,
            displayName: userCredential.displayName
        };

        const idToken = await auth.currentUser.getIdToken();

        return h.response({
            error: false,
            message: 'Login successful',
            data: {
                ...userData,
                token: idToken
            }
        }).code(200);
    } catch (error) {
        console.error(error);
        return h.response({ error: true, message: 'Login failed' }).code(401);
    }
};

export const loginEmail = async (request, h) => {
    const { email, password } = request.payload;

    if (email && password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userId = userCredential.user.uid;
            const userData = {
                uid: userId,
                email: email
            };

            const idToken = await auth.currentUser.getIdToken();
            const userRef = doc(firestore, 'users', userId);
            const docSnap = await getDoc(userRef);

            if (!docSnap.exists()) {
                console.log('No such document!');
                return h.response({ error: true, message: 'No such document!' }).code(404);
            } else {
                const userDoc = docSnap.data();
                console.log('Document data:', userDoc);

                const name = userDoc.name;

                return h.response({
                    error: false,
                    message: 'Login successful',
                    data: {
                        ...userData,
                        name,
                        token: idToken
                    }
                }).code(200);
            }
        } catch (error) {
            console.error(error);
            return h.response({ error: true, message: 'Login failed ' + error.message }).code(401);
        }
    } else {
        return h.response({ error: true, message: 'Please provide email and password' }).code(400);
    }
};

export const addTransaction = async (request, h) => {
    const { date, name, amount, category, type } = request.payload;

    if (!date || !name || !amount || !category || !type) {
        return h.response({
            error: true,
            message: 'All fields (date, name, amount, category, type) are required.'
        }).code(400);
    }

    try {
        const user = request.user;
        if (!user) {
            return h.response({ error: true, message: 'User is not authenticated' }).code(401);
        }

        const transactionData = {
            date: Timestamp.fromDate(new Date(date)),
            name: name.trim(),
            amount: parseFloat(amount),
            category: category.trim(),
            type: type.trim(),
            userId: user.uid,
        };

        const transactionRef = collection(firestore, 'users', user.uid, 'transaction');
        const transactionDoc = await addDoc(transactionRef, transactionData);

        return h.response({
            error: false,
            message: 'Transaction added successfully',
            data: { id: transactionDoc.id, ...transactionData }
        }).code(201);
    } catch (error) {
        console.error(error);
        return h.response({ error: true, message: 'Failed to add transaction ' + error.message }).code(500);
    }
};

export const getTransaction = async (request, h) => {
    try {
        const user = request.user;
        if (!user) {
            return h.response({ error: true, message: 'User is not authenticated' }).code(401);
        }

        const transactionRef = collection(firestore, 'users', user.uid, 'transaction');
        const q = query(transactionRef);

        const querySnapshot = await getDocs(q);
        const transactions = [];

        querySnapshot.forEach((doc) => {
            transactions.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return h.response({
            error: false,
            message: 'Transactions retrieved successfully',
            data: transactions
        }).code(200);
    } catch (error) {
        console.error(error);
        return h.response({ error: true, message: 'Failed to get transactions ' + error.message }).code(500);
    }
};

// Wishlist Handlers
// Function to upload file to Google Cloud Storage
const uploadFile = async (file, folderName) => {
    const bucket = storage.bucket('capstone-bangkit-2024'); // Replace with your bucket name
    const fileName = `${folderName}/${uuidv4()}-${file.hapi.filename}`;
    const fileUpload = bucket.file(fileName);

    await new Promise((resolve, reject) => {
        const fileStream = fileUpload.createWriteStream({
            metadata: {
                contentType: file.hapi.headers['content-type'],
            },
        });

        fileStream.on('error', (err) => {
            console.error('File upload error:', err);
            reject(err);
        });

        fileStream.on('finish', () => {
            console.log('File upload finished');
            resolve();
        });

        file.pipe(fileStream);
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    return imageUrl;
};

// Function to delete file from Google Cloud Storage
const deleteFile = async (imageUrl) => {
    const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
    const bucket = storage.bucket('capstone-bangkit-2024'); // Replace with your bucket name
    const fileToDelete = bucket.file(`images/${fileName}`);

    await fileToDelete.delete();
};

export const addWishlistItem = async (request, h) => {
    const { name, amount, saving_plan, type } = request.payload;

    if (!name || !amount || !saving_plan || !type || !request.payload.file) {
        return h.response({
            error: true,
            message: 'All fields (name, amount, saving_plan, type, file) are required.'
        }).code(400);
    }

    try {
        const user = request.user;
        if (!user) {
            return h.response({ error: true, message: 'User is not authenticated' }).code(401);
        }

        const file = request.payload.file; // Access file directly from request.payload

        const imageUrl = await uploadFile(file, 'images');

        const wishlistItemData = {
            name: name.trim(),
            amount: parseFloat(amount),
            saving_plan: saving_plan.trim(),
            type: type.trim(),
            image: imageUrl,
            userId: user.uid,
        };

        const wishlistRef = collection(firestore, 'users', user.uid, 'wishlist');
        const wishlistDoc = await addDoc(wishlistRef, wishlistItemData);

        return h.response({
            error: false,
            message: 'Wishlist item added successfully',
            data: { id: wishlistDoc.id, ...wishlistItemData }
        }).code(201);
    } catch (error) {
        console.error('Error adding wishlist item:', error);
        return h.response({ error: true, message: 'Failed to add wishlist item ' + error.message }).code(500);
    }
};

export const getWishlistItems = async (request, h) => {
    try {
        const user = request.user;
        if (!user) {
            return h.response({ error: true, message: 'User is not authenticated' }).code(401);
        }

        const wishlistRef = collection(firestore, 'users', user.uid, 'wishlist');
        const querySnapshot = await getDocs(wishlistRef);
        const wishlistItems = [];

        querySnapshot.forEach((doc) => {
            wishlistItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return h.response({
            error: false,
            message: 'Wishlist items retrieved successfully',
            data: wishlistItems
        }).code(200);
    } catch (error) {
        console.error('Error getting wishlist items:', error);
        return h.response({ error: true, message: 'Failed to get wishlist items ' + error.message }).code(500);
    }
};

export const updateWishlistItem = async (request, h) => {
    const { id } = request.params;
    const { name, amount, saving_plan, type } = request.payload;

    try {
        const user = request.user;
        if (!user) {
            return h.response({ error: true, message: 'User is not authenticated' }).code(401);
        }

        const wishlistRef = doc(firestore, 'users', user.uid, 'wishlist', id);
        const docSnap = await getDoc(wishlistRef);

        if (!docSnap.exists()) {
            return h.response({ error: true, message: 'Wishlist item not found' }).code(404);
        }

        let updatedData = {
            name: name ? name.trim() : docSnap.data().name,
            amount: amount ? parseFloat(amount) : docSnap.data().amount,
            saving_plan: saving_plan ? saving_plan.trim() : docSnap.data().saving_plan,
            type: type ? type.trim() : docSnap.data().type,
            updatedAt: new Date(),
        };

        const file = request.payload.file;

        if (file) {
            // Delete old image from Google Cloud Storage
            await deleteFile(docSnap.data().image);

            // Upload new image to Google Cloud Storage
            updatedData.image = await uploadFile(file, 'images');
        }

        await updateDoc(wishlistRef, updatedData);

        return h.response({
            error: false,
            message: 'Wishlist item updated successfully',
            data: { id, ...updatedData }
        }).code(200);
    } catch (error) {
        console.error('Error updating wishlist item:', error);
        return h.response({ error: true, message: 'Failed to update wishlist item ' + error.message }).code(500);
    }
};

export const deleteWishlistItem = async (request, h) => {
    const { id } = request.params;

    try {
        const user = request.user;
        if (!user) {
            return h.response({ error: true, message: 'User is not authenticated' }).code(401);
        }

        const wishlistRef = doc(firestore, 'users', user.uid, 'wishlist', id);
        const docSnap = await getDoc(wishlistRef);

        if (!docSnap.exists()) {
            return h.response({ error: true, message: 'Wishlist item not found' }).code(404);
        }

        // Delete image from Google Cloud Storage
        await deleteFile(docSnap.data().image);

        // Delete wishlist item from Firestore
        await deleteDoc(wishlistRef);

        return h.response({
            error: false,
            message: 'Wishlist item deleted successfully',
            data: { id }
        }).code(200);
    } catch (error) {
        console.error('Error deleting wishlist item:', error);
        return h.response({ error: true, message: 'Failed to delete wishlist item ' + error.message }).code(500);
    }
};

export default initFirebase;
