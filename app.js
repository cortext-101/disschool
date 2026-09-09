// ============================================================
// FriendCall - app.js
// ============================================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// ============================================================
// 🔥 FIREBASE CONFIG
// REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT VALUES
// ============================================================

const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_AUTH_DOMAIN_HERE",
  projectId: "PASTE_PROJECT_ID_HERE",
  storageBucket: "PASTE_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE"
};


// ============================================================
// FIREBASE STARTUP
// ============================================================

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentServer = null;
let currentChannel = null;
let unsubscribeMessages = null;
let unsubscribeServers = null;
let unsubscribeFriends = null;


// ============================================================
// ELEMENTS
// ============================================================

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("app");

const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const signupButton = document.getElementById("signup");
const loginButton = document.getElementById("login");

const authError = document.getElementById("authError");

const currentUserDisplay =
  document.getElementById("currentUser");

const serversElement =
  document.getElementById("servers");

const serverNameElement =
  document.getElementById("serverName");

const textChannelsElement =
  document.getElementById("textChannels");

const voiceChannelsElement =
  document.getElementById("voiceChannels");

const messagesElement =
  document.getElementById("messages");

const messageInput =
  document.getElementById("messageInput");

const messageForm =
  document.getElementById("messageForm");

const channelNameElement =
  document.getElementById("channelName");

const welcomeElement =
  document.getElementById("welcome");

const chatScreen =
  document.getElementById("chatScreen");

const voiceScreen =
  document.getElementById("voiceScreen");

const voiceChannelName =
  document.getElementById("voiceChannelName");


// ============================================================
// SIGN UP
// ============================================================

signupButton.addEventListener("click", async () => {

  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!username || !email || !password) {
    authError.textContent =
      "Fill in all the boxes.";
    return;
  }

  if (password.length < 6) {
    authError.textContent =
      "Password must be at least 6 characters.";
    return;
  }

  try {

    const result =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    await setDoc(
      doc(db, "users", result.user.uid),
      {
        username: username,
        email: email,
        friends: [],
        createdAt: serverTimestamp()
      }
    );

  } catch (error) {

    authError.textContent =
      readableFirebaseError(error);

  }

});


// ============================================================
// LOGIN
// ============================================================

loginButton.addEventListener("click", async () => {

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authError.textContent =
      "Enter your email and password.";
    return;
  }

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (error) {

    authError.textContent =
      readableFirebaseError(error);

  }

});


// ============================================================
// LOGOUT
// ============================================================

document
  .getElementById("logout")
  .addEventListener("click", async () => {

    await signOut(auth);

  });


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async user => {

  currentUser = user;

  if (user) {

    authScreen.hidden = true;
    appScreen.hidden = false;

    const userDoc =
      await getDoc(
        doc(db, "users", user.uid)
      );

    if (userDoc.exists()) {

      const data = userDoc.data();

      currentUserDisplay.textContent =
        data.username || user.email;

    }

    loadServers();
    loadFriends();

    checkInvite();

  } else {

    authScreen.hidden = false;
    appScreen.hidden = true;

  }

});


// ============================================================
// CREATE SERVER
// ============================================================

document
  .getElementById("createServer")
  .addEventListener("click", async () => {

    const name =
      prompt("What should your server be called?");

    if (!name) return;

    const serverRef =
      await addDoc(
        collection(db, "servers"),
        {
          name: name,
          owner: currentUser.uid,
          members: [currentUser.uid],
          createdAt: serverTimestamp()
        }
      );

    await addDoc(
      collection(
        db,
        "servers",
        serverRef.id,
        "channels"
      ),
      {
        name: "general",
        type: "text",
        createdAt: serverTimestamp()
      }
    );

    await addDoc(
      collection(
        db,
        "servers",
        serverRef.id,
        "channels"
      ),
      {
        name: "General",
        type: "voice",
        createdAt: serverTimestamp()
      }
    );

    alert("Server created!");

    loadServers();

  });


// ============================================================
// LOAD SERVERS
// ============================================================

function loadServers() {

  if (unsubscribeServers) {
    unsubscribeServers();
  }

  const q =
    query(
      collection(db, "servers"),
      where(
        "members",
        "array-contains",
        currentUser.uid
      )
    );

  unsubscribeServers =
    onSnapshot(q, snapshot => {

      serversElement.innerHTML = "";

      snapshot.forEach(serverDoc => {

        const server =
          serverDoc.data();

        const button =
          document.createElement("div");

        button.className = "server";

        button.textContent =
          server.name
            .substring(0, 2)
            .toUpperCase();

        button.title =
          server.name;

        button.onclick = () => {

          selectServer(
            serverDoc.id,
            server
          );

        };

        serversElement.appendChild(button);

      });

    });

}


// ============================================================
// SELECT SERVER
// ============================================================

async function selectServer(id, server) {

  currentServer = {
    id: id,
    ...server
  };

  serverNameElement.textContent =
    server.name;

  welcomeElement.hidden = true;

  await loadChannels();

}


// ============================================================
// LOAD CHANNELS
// ============================================================

async function loadChannels() {

  textChannelsElement.innerHTML = "";
  voiceChannelsElement.innerHTML = "";

  const snapshot =
    await getDocs(
      collection(
        db,
        "servers",
        currentServer.id,
        "channels"
      )
    );

  snapshot.forEach(channelDoc => {

    const channel =
      channelDoc.data();

    const button =
      document.createElement("div");

    button.className =
      "channel";

    if (channel.type === "voice") {

      button.classList.add("voice");

      button.textContent =
        "🔊 " + channel.name;

      button.onclick = () => {

        joinVoiceChannel(
          channelDoc.id,
          channel.name
        );

      };

      voiceChannelsElement.appendChild(button);

    } else {

      button.textContent =
        "# " + channel.name;

      button.onclick = () => {

        openTextChannel(
          channelDoc.id,
          channel.name
        );

      };

      textChannelsElement.appendChild(button);

    }

  });

}


// ============================================================
// ADD TEXT CHANNEL
// ============================================================

document
  .getElementById("addTextChannel")
  .addEventListener("click", async () => {

    if (!currentServer) {
      alert("Select a server first.");
      return;
    }

    const name =
      prompt("Text channel name:");

    if (!name) return;

    await addDoc(
      collection(
        db,
        "servers",
        currentServer.id,
        "channels"
      ),
      {
        name: name,
        type: "text",
        createdAt: serverTimestamp()
      }
    );

    loadChannels();

  });


// ============================================================
// ADD VOICE CHANNEL
// ============================================================

document
  .getElementById("addVoiceChannel")
  .addEventListener("click", async () => {

    if (!currentServer) {
      alert("Select a server first.");
      return;
    }

    const name =
      prompt("Voice channel name:");

    if (!name) return;

    await addDoc(
      collection(
        db,
        "servers",
        currentServer.id,
        "channels"
      ),
      {
        name: name,
        type: "voice",
        createdAt: serverTimestamp()
      }
    );

    loadChannels();

  });


// ============================================================
// OPEN TEXT CHANNEL
// ============================================================

function openTextChannel(id, name) {

  currentChannel = {
    id: id,
    name: name
  };

  chatScreen.hidden = false;
  voiceScreen.hidden = true;

  channelNameElement.textContent =
    "# " + name;

  messagesElement.innerHTML = "";

  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  const q =
    query(
      collection(
        db,
        "servers",
        currentServer.id,
        "channels",
        id,
        "messages"
      ),
      orderBy("createdAt", "asc")
    );

  unsubscribeMessages =
    onSnapshot(q, snapshot => {

      messagesElement.innerHTML = "";

      snapshot.forEach(messageDoc => {

        const message =
          messageDoc.data();

        const wrapper =
          document.createElement("div");

        wrapper.className =
          "message";

        const author =
          document.createElement("span");

        author.className =
          "message-author";

        author.textContent =
          message.username || "User";

        const content =
          document.createElement("div");

        content.className =
          "message-content";

        content.textContent =
          message.text;

        wrapper.appendChild(author);
        wrapper.appendChild(content);

        messagesElement.appendChild(wrapper);

      });

      messagesElement.scrollTop =
        messagesElement.scrollHeight;

    });

}


// ============================================================
// SEND MESSAGE
// ============================================================

messageForm.addEventListener("submit", async event => {

  event.preventDefault();

  if (!currentServer || !currentChannel) {
    return;
  }

  const text =
    messageInput.value.trim();

  if (!text) return;

  const userDoc =
    await getDoc(
      doc(db, "users", currentUser.uid)
    );

  const username =
    userDoc.exists()
      ? userDoc.data().username
      : currentUser.email;

  await addDoc(
    collection(
      db,
      "servers",
      currentServer.id,
      "channels",
      currentChannel.id,
      "messages"
    ),
    {
      text: text,
      uid: currentUser.uid,
      username: username,
      createdAt: serverTimestamp()
    }
  );

  messageInput.value = "";

});


// ============================================================
// INVITES
// ============================================================

document
  .getElementById("inviteButton")
  .addEventListener("click", async () => {

    if (!currentServer) {
      alert("Select a server first.");
      return;
    }

    const code =
      randomCode();

    await setDoc(
      doc(db, "invites", code),
      {
        serverId: currentServer.id,
        serverName: currentServer.name,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      }
    );

    const url =
      window.location.origin +
      window.location.pathname +
      "?invite=" +
      code;

    document.getElementById("inviteLink").value =
      url;

    document.getElementById("invitePopup").hidden =
      false;

  });


// ============================================================
// COPY INVITE
// ============================================================

document
  .getElementById("copyInvite")
  .addEventListener("click", async () => {

    const input =
      document.getElementById("inviteLink");

    await navigator.clipboard.writeText(
      input.value
    );

    document.getElementById("copyInvite").textContent =
      "Copied!";

    setTimeout(() => {

      document.getElementById("copyInvite").textContent =
        "Copy Invite Link";

    }, 1500);

  });


// ============================================================
// CLOSE INVITE
// ============================================================

document
  .getElementById("closeInvite")
  .addEventListener("click", () => {

    document.getElementById("invitePopup").hidden =
      true;

  });


// ============================================================
// CHECK INVITE URL
// ============================================================

async function checkInvite() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const code =
    params.get("invite");

  if (!code) return;

  const inviteDoc =
    await getDoc(
      doc(db, "invites", code)
    );

  if (!inviteDoc.exists()) {

    alert("That invite doesn't exist.");

    return;

  }

  const invite =
    inviteDoc.data();

  document.getElementById(
    "joinServerName"
  ).textContent =
    "Join " + invite.serverName + "?";

  document.getElementById(
    "joinPopup"
  ).hidden = false;

  document.getElementById(
    "joinServer"
  ).onclick = async () => {

    const serverRef =
      doc(db, "servers", invite.serverId);

    await updateDoc(
      serverRef,
      {
        members:
          arrayUnion(currentUser.uid)
      }
    );

    document.getElementById(
      "joinPopup"
    ).hidden = true;

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    loadServers();

    alert(
      "Joined " + invite.serverName + "!"
    );

  };

}


// ============================================================
// FRIEND SYSTEM
// ============================================================

document
  .getElementById("addFriend")
  .addEventListener("click", async () => {

    const email =
      document
        .getElementById("friendEmail")
        .value
        .trim()
        .toLowerCase();

    if (!email) return;

    const q =
      query(
        collection(db, "users"),
        where("email", "==", email)
      );

    const snapshot =
      await getDocs(q);

    if (snapshot.empty) {

      alert("User not found.");

      return;

    }

    const friendDoc =
      snapshot.docs[0];

    if (friendDoc.id === currentUser.uid) {

      alert("You can't add yourself.");

      return;

    }

    await updateDoc(
      doc(db, "users", currentUser.uid),
      {
        friends:
          arrayUnion(friendDoc.id)
      }
    );

    document.getElementById(
      "friendEmail"
    ).value = "";

    alert("Friend added!");

  });


// ============================================================
// LOAD FRIENDS
// ============================================================

function loadFriends() {

  if (unsubscribeFriends) {
    unsubscribeFriends();
  }

  unsubscribeFriends =
    onSnapshot(
      doc(db, "users", currentUser.uid),
      async snapshot => {

        if (!snapshot.exists()) return;

        const data =
          snapshot.data();

        const friendIDs =
          data.friends || [];

        const list =
          document.getElementById("friendsList");

        list.innerHTML = "";

        for (const friendID of friendIDs) {

          const friendDoc =
            await getDoc(
              doc(db, "users", friendID)
            );

          if (!friendDoc.exists()) continue;

          const friend =
            friendDoc.data();

          const div =
            document.createElement("div");

          div.className =
            "friend";

          const name =
            document.createElement("span");

          name.className =
            "friend-name";

          name.textContent =
            friend.username || friend.email;

          const call =
            document.createElement("button");

          call.className =
            "call-button";

          call.textContent =
            "📞";

          call.onclick = () => {

            startFriendCall(
              friendID,
              friend.username
            );

          };

          div.appendChild(name);
          div.appendChild(call);

          list.appendChild(div);

        }

      }
    );

}


// ============================================================
// FRIEND CALL
// ============================================================

async function startFriendCall(
  friendID,
  friendName
) {

  await addDoc(
    collection(db, "calls"),
    {
      caller: currentUser.uid,
      receiver: friendID,
      callerName:
        currentUserDisplay.textContent,
      status: "ringing",
      createdAt: serverTimestamp()
    }
  );

  alert(
    "Calling " + friendName + "..."
  );

}


// ============================================================
// VOICE CHANNEL
// ============================================================

async function joinVoiceChannel(
  channelID,
  channelName
) {

  voiceScreen.hidden = false;
  chatScreen.hidden = true;

  voiceChannelName.textContent =
    channelName;

  document.getElementById(
    "voiceMembers"
  ).innerHTML =
    `
      <div class="voice-member">
        🎙️
        <br>
        You
      </div>
    `;

  /*
    The actual WebRTC voice connection
    is loaded by voice.js.

    voice.js will use:
      - microphone
      - WebRTC
      - Firebase signaling
  */

  if (
    window.joinFriendCallVoiceChannel
  ) {

    window.joinFriendCallVoiceChannel(
      currentServer.id,
      channelID,
      currentUser.uid
    );

  }

}


// ============================================================
// LEAVE VOICE
// ============================================================

document
  .getElementById("leaveVoice")
  .addEventListener("click", () => {

    voiceScreen.hidden = true;

    if (
      window.leaveFriendCallVoiceChannel
    ) {

      window.leaveFriendCallVoiceChannel();

    }

  });


// ============================================================
// MUTE
// ============================================================

document
  .getElementById("muteButton")
  .addEventListener("click", () => {

    if (
      window.toggleFriendCallMute
    ) {

      const muted =
        window.toggleFriendCallMute();

      document.getElementById(
        "muteButton"
      ).textContent =
        muted
          ? "🔇 Unmute"
          : "🎙️ Mute";

    }

  });


// ============================================================
// RANDOM INVITE CODE
// ============================================================

function randomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 8; i++) {

    result +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];

  }

  return result;

}


// ============================================================
// FIREBASE ERROR TRANSLATION
// ============================================================

function readableFirebaseError(error) {

  switch (error.code) {

    case "auth/email-already-in-use":
      return "That email already has an account.";

    case "auth/invalid-email":
      return "That email isn't valid.";

    case "auth/weak-password":
      return "Password is too weak.";

    case "auth/invalid-credential":
      return "Wrong email or password.";

    case "auth/user-not-found":
      return "Account not found.";

    default:
      return error.message;

  }

}
