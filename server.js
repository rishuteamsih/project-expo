// server.js — Unified Firebase + App Helper Module
// Works with <script type="module"> in your HTML

// ---------------- Firebase Imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    reauthenticateWithCredential,
    EmailAuthProvider,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import {
    getStorage,
    ref as sRef,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    listAll
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

import {
    getDatabase,
    ref as rRef,
    set as rSet,
    get as rGet,
    child as rChild,
    push as rPush,
    onValue as rOnValue
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ---------------- Config ----------------
const firebaseConfig = {
    apiKey: "AIzaSyAFKmM22FUSQPYy-eMsBzcZN3bmAxglXl0",
    authDomain: "smart-timetable-266fe.firebaseapp.com",
    databaseURL: "https://smart-timetable-266fe-default-rtdb.firebaseio.com",
    projectId: "smart-timetable-266fe",
    storageBucket: "smart-timetable-266fe.firebasestorage.app", // ✅ fixed here
    messagingSenderId: "843230713835",
    appId: "1:843230713835:web:b97d024f4fcf9a40ceabae",
    measurementId: "G-DDY9NVEK8R"
};


// ---------------- Initialization ----------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rdb = getDatabase(app);

// ---------------- EXPORTS ----------------
export {
    app,
    auth,
    db,
    storage,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    reauthenticateWithCredential,
    EmailAuthProvider,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    sRef,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    listAll,
    rRef,
    rSet,
    rGet,
    rChild,
    rPush,
    rOnValue
};

// ---------------- Auth Helpers ----------------
export function getCurrentUser() {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
            unsub();
            resolve(user || null);
        });
    });
}

export function requireAuth(cb) {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            alert("Session expired or not logged in. Please sign in again.");
            window.location.href = "index.html";
        } else {
            cb(user);
        }
    });
}

// ---------------- Profile Helpers ----------------
export async function getUserProfile(uid) {
    try {
        const refDoc = doc(db, "users", uid);
        const snap = await getDoc(refDoc);
        return snap.exists() ? snap.data() : null;
    } catch (err) {
        console.error("Error fetching profile:", err);
        return null;
    }
}

export async function saveUserProfile(uid, data) {
    try {
        await setDoc(doc(db, "users", uid), data, { merge: true });
        return true;
    } catch (err) {
        console.error("Error saving profile:", err);
        return false;
    }
}

// ---------------- Classroom Helpers ----------------
export async function createClassroom(uid, name, code) {
    const docRef = await addDoc(collection(db, "classes"), {
        name,
        code,
        creator: uid,
        members: [uid],
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

export async function getUserClassrooms(uid) {
    const q = query(collection(db, "classes"), where("members", "array-contains", uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------------- Notice Helpers ----------------
export async function postNotice(title, message, file = null, sender = null) {
    let fileURL = "", fileName = "";
    if (file) {
        const path = `notices/${Date.now()}_${file.name}`;
        const fileRef = sRef(storage, path);
        const uploadTask = await uploadBytesResumable(fileRef, file);
        fileURL = await getDownloadURL(uploadTask.ref);
        fileName = file.name;
    }
    return await addDoc(collection(db, "notices"), {
        title,
        message,
        fileURL,
        fileName,
        sender,
        createdAt: serverTimestamp()
    });
}

export async function getNotices() {
    const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---------------- Upload / Download Helpers ----------------
export async function uploadFile(path, file, onProgress = null) {
    const refUp = sRef(storage, path);
    const uploadTask = uploadBytesResumable(refUp, file);
    return new Promise((resolve, reject) => {
        uploadTask.on(
            "state_changed",
            (snapshot) => {
                if (onProgress && snapshot.totalBytes) {
                    onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                }
            },
            (error) => reject(error),
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({ url, ref: uploadTask.snapshot.ref });
            }
        );
    });
}

export async function listDocumentsByRoll(rollNo) {
    try {
        const folderRef = sRef(storage, `documents/${rollNo}`);
        const res = await listAll(folderRef);
        const urls = await Promise.all(
            res.items.map(async (itemRef) => ({
                name: itemRef.name,
                url: await getDownloadURL(itemRef)
            }))
        );
        return urls;
    } catch (err) {
        console.error("Error listing documents:", err);
        return [];
    }
}

// ---------------- Realtime Test Helpers ----------------
export async function createOrUpdateTest({ testId, title, duration, questions }) {
    if (!testId || !title || !duration || !Array.isArray(questions)) {
        throw new Error("Invalid test data");
    }
    await rSet(rRef(rdb, "tests/" + testId), { testId, title, duration, questions });
    return { ok: true, testId };
}

export async function getTest(testId) {
    const snap = await rGet(rRef(rdb, `tests/${testId}`));
    return snap.exists() ? snap.val() : null;
}

export async function submitTest({ testId, studentName, studentId, answers }) {
    const testSnap = await rGet(rRef(rdb, `tests/${testId}`));
    if (!testSnap.exists()) throw new Error("Test not found");
    const test = testSnap.val();
    let score = 0, max = 0;
    const results = test.questions.map((q, i) => {
        const ans = answers?.[i] ?? "";
        let correct = false;
        if (q.type === "mcq" || q.type === "fill") {
            max += q.marks;
            correct = ans.toLowerCase().trim() === q.answer.toLowerCase().trim();
            if (correct) score += q.marks;
        }
        return { q: i + 1, correct, ans };
    });
    await rPush(rRef(rdb, `submissions/${testId}`), {
        studentName,
        studentId,
        answers,
        score,
        max,
        submittedAt: Date.now()
    });
    return { score, max, results };
}

// ---------------- RollNo & Password Logic ----------------
export async function registerUser(email, password, name, role = "student") {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const rollNo = email.split("@")[0];
    await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        email,
        role,
        rollNo,
        createdAt: serverTimestamp()
    });
    return user;
}

export async function forgotPassword(email) {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset link sent to " + email);
}

// ---------------- Protected Download (Password Verification) ----------------
export async function verifyPassword(password) {
    if (!auth.currentUser) throw new Error("Not logged in");
    const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, cred);
    return true;
}

// ---------------- End ----------------
