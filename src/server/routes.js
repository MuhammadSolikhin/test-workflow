import { 
    register, 
    loginGoogle, 
    loginEmail, 
    addTransaction, 
    verifyToken, 
    getTransaction, 
    addWishlistItem, 
    getWishlistItems,
    updateWishlistItem, 
    deleteWishlistItem 
} from './handler.js';

export default [
    {
        method: 'POST',
        path: '/register',
        handler: register,
    },
    {
        method: 'POST',
        path: '/login/google',
        handler: loginGoogle,
    },
    {
        method: 'POST',
        path: '/login/email',
        handler: loginEmail,
    },
    {
        method: 'POST',
        path: '/transaction',
        options: {
            pre: [verifyToken],
        },
        handler: addTransaction,
    },
    {
        method: 'GET',
        path: '/transaction',
        options: {
            pre: [verifyToken],
        },
        handler: getTransaction,
    },
    {
        method: 'POST',
        path: '/wishlist',
        options: {
            pre: [verifyToken],
            payload: {
                multipart: true,
                allow: 'multipart/form-data',
                output: 'stream'
            }
        },
        handler: addWishlistItem,
    },
    {
        method: 'GET',
        path: '/wishlist',
        options: {
            pre: [verifyToken],
        },
        handler: getWishlistItems,
    },
    {
        method: 'PUT',
        path: '/wishlist/{id}',
        options: {
            pre: [verifyToken],
            payload: {
                multipart: true,
                allow: 'multipart/form-data',
                output: 'stream'
            }
        },
        handler: updateWishlistItem,
    },
    {
        method: 'DELETE',
        path: '/wishlist/{id}',
        options: {
            pre: [verifyToken],
        },
        handler: deleteWishlistItem,
    },
];
