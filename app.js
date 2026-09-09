import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  "https://swlpnetfbbepduapkawc.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_X35avJuVQ_TUFwp-cr0xMA_cyQQB_HK";

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


// ============================================================
// STATE
// ============================================================

let currentUser = null;
let currentServer = null;
let currentChannel = null;
let messageSubscription = null;


// ============================================================
// ELEMENTS
// ============================================================

const authScreen =
  document.getElementById("authScreen");

const appScreen =
  document.getElementById("app");

const usernameInput =
  document.getElementById("username");

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const authError =
  document.getElementById("authError");

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

const welcomeElement =
  document.getElementById("welcome");

const chatScreen =
  document.getElementById("chatScreen");

const voiceScreen =
  document.getElementById("voiceScreen");

const channelNameElement =
  document.getElementById("channelName");

const messagesElement =
  document.getElementById("messages");

const messageForm =
  document.getElementById("messageForm");

const messageInput =
  document.getElementById("messageInput");

const voiceChannelName =
  document.getElementById("voiceChannelName");


// ============================================================
// SIGN UP
// ============================================================

document.getElementById("signup").onclick =
  async () => {

    authError.textContent = "";

    const username =
      usernameInput.value.trim();

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;

    if (!username || !email || !password) {
      authError.textContent =
        "Fill in everything.";
      return;
    }

    if (password.length < 6) {
      authError.textContent =
        "Password needs at least 6 characters.";
      return;
    }


    // Check username before creating account
    const { data: existingUsername } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

    if (existingUsername) {
      authError.textContent =
        "That username is already taken.";
      return;
    }


    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });


    if (error) {
      authError.textContent =
        error.message;
      return;
    }


    if (!data.user) {
      authError.textContent =
        "Account could not be created.";
      return;
    }


    // Create profile
    const { error: profileError } =
      await supabase
        .from("profiles")
        .upsert({
          id: data.user.id,
          username,
          email
        });


    if (profileError) {
      console.error(
        "Profile error:",
        profileError
      );
    }


    if (data.session) {

      alert("Account created!");

    } else {

      alert(
        "Account created! Check your email if confirmation is required."
      );

    }

  };


// ============================================================
// LOGIN
// ============================================================

document.getElementById("login").onclick =
  async () => {

    authError.textContent = "";

    const email =
      emailInput.value.trim();

    const password =
      passwordInput.value;

    if (!email || !password) {

      authError.textContent =
        "Enter your email and password.";

      return;
    }


    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });


    if (error) {

      authError.textContent =
        error.message;

    }

  };


// ============================================================
// LOGOUT
// ============================================================

document.getElementById("logout").onclick =
  async () => {

    await supabase.auth.signOut();

    currentUser = null;
    currentServer = null;
    currentChannel = null;


    if (messageSubscription) {

      await supabase.removeChannel(
        messageSubscription
      );

      messageSubscription = null;

    }


    authScreen.hidden = false;
    appScreen.hidden = true;

  };


// ============================================================
// CHECK USER
// ============================================================

async function checkUser() {

  const {
    data: { user }
  } =
    await supabase.auth.getUser();


  if (!user) {

    currentUser = null;

    authScreen.hidden = false;
    appScreen.hidden = true;

    return;

  }


  currentUser = user;

  authScreen.hidden = true;
  appScreen.hidden = false;


  await loadProfile();
  await loadServers();
  await loadFriends();

}


// ============================================================
// PROFILE
// ============================================================

async function loadProfile() {

  const { data, error } =
    await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();


  if (error) {

    console.error(
      "Profile error:",
      error
    );

    return;
  }


  if (currentUserDisplay) {

    currentUserDisplay.textContent =
      data.username;

  }

}


// ============================================================
// CREATE SERVER
// ============================================================

document.getElementById("createServer").onclick =
  async () => {

    if (!currentUser) {

      alert(
        "You must be logged in."
      );

      return;
    }


    const name =
      prompt("Server name:");


    if (!name) return;


    const { data: server, error } =
      await supabase
        .from("servers")
        .insert({
          name: name.trim(),
          owner_id: currentUser.id
        })
        .select()
        .single();


    if (error) {

      alert(error.message);
      return;

    }


    const { error: memberError } =
      await supabase
        .from("server_members")
        .insert({
          server_id: server.id,
          user_id: currentUser.id
        });


    if (memberError) {

      alert(memberError.message);
      return;

    }


    await supabase
      .from("channels")
      .insert({
        server_id: server.id,
        name: "general",
        type: "text"
      });


    await supabase
      .from("channels")
      .insert({
        server_id: server.id,
        name: "General",
        type: "voice"
      });


    await loadServers();

    await selectServer(server);

  };


// ============================================================
// LOAD SERVERS
// ============================================================

async function loadServers() {

  serversElement.innerHTML = "";

  if (!currentUser) return;


  const { data: memberships, error } =
    await supabase
      .from("server_members")
      .select("server_id")
      .eq(
        "user_id",
        currentUser.id
      );


  if (error) {

    console.error(
      "Membership error:",
      error
    );

    return;

  }


  for (const membership of memberships || []) {

    const { data: server } =
      await supabase
        .from("servers")
        .select("*")
        .eq(
          "id",
          membership.server_id
        )
        .single();


    if (!server) continue;


    const button =
      document.createElement("div");


    button.className =
      "server";


    button.textContent =
      server.name
        .substring(0, 2)
        .toUpperCase();


    button.title =
      server.name;


    button.onclick =
      () => selectServer(server);


    serversElement.appendChild(button);

  }

}


// ============================================================
// SELECT SERVER
// ============================================================

async function selectServer(server) {

  currentServer = server;

  serverNameElement.textContent =
    server.name;


  welcomeElement.hidden = true;

  chatScreen.hidden = true;
  voiceScreen.hidden = true;


  await loadChannels();

}


// ============================================================
// LOAD CHANNELS
// ============================================================

async function loadChannels() {

  textChannelsElement.innerHTML = "";
  voiceChannelsElement.innerHTML = "";


  if (!currentServer) return;


  const { data: channels, error } =
    await supabase
      .from("channels")
      .select("*")
      .eq(
        "server_id",
        currentServer.id
      )
      .order("created_at");


  if (error) {

    console.error(
      "Channel error:",
      error
    );

    return;

  }


  for (const channel of channels || []) {

    const button =
      document.createElement("div");


    button.className =
      "channel";


    if (channel.type === "voice") {

      button.classList.add("voice");

      button.textContent =
        "🔊 " + channel.name;


      button.onclick =
        () => joinVoiceChannel(
          channel.id,
          channel.name
        );


      voiceChannelsElement
        .appendChild(button);


    } else {

      button.textContent =
        "# " + channel.name;


      button.onclick =
        () => openTextChannel(
          channel.id,
          channel.name
        );


      textChannelsElement
        .appendChild(button);

    }

  }

}


// ============================================================
// ADD TEXT CHANNEL
// ============================================================

document.getElementById("addTextChannel").onclick =
  async () => {

    if (!currentServer) {

      alert(
        "Pick a server first."
      );

      return;

    }


    const name =
      prompt("Channel name:");


    if (!name) return;


    const { error } =
      await supabase
        .from("channels")
        .insert({
          server_id: currentServer.id,
          name: name.trim(),
          type: "text"
        });


    if (error) {

      alert(error.message);
      return;

    }


    await loadChannels();

  };


// ============================================================
// ADD VOICE CHANNEL
// ============================================================

document.getElementById("addVoiceChannel").onclick =
  async () => {

    if (!currentServer) {

      alert(
        "Pick a server first."
      );

      return;

    }


    const name =
      prompt("Voice channel name:");


    if (!name) return;


    const { error } =
      await supabase
        .from("channels")
        .insert({
          server_id: currentServer.id,
          name: name.trim(),
          type: "voice"
        });


    if (error) {

      alert(error.message);
      return;

    }


    await loadChannels();

  };


// ============================================================
// OPEN TEXT CHANNEL
// ============================================================

async function openTextChannel(id, name) {

  currentChannel = {
    id,
    name
  };


  welcomeElement.hidden = true;

  chatScreen.hidden = false;
  voiceScreen.hidden = true;


  channelNameElement.textContent =
    "# " + name;


  if (messageSubscription) {

    await supabase.removeChannel(
      messageSubscription
    );

    messageSubscription = null;

  }


  await loadMessages(id);


  messageSubscription =
    supabase
      .channel(
        "messages-" + id
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter:
            "channel_id=eq." + id
        },
        payload => {

          addMessageToScreen(
            payload.new
          );

        }
      )
      .subscribe();

}


// ============================================================
// LOAD MESSAGES
// ============================================================

async function loadMessages(channelID) {

  messagesElement.innerHTML = "";


  const { data: messages, error } =
    await supabase
      .from("messages")
      .select(`
        *,
        profiles(username)
      `)
      .eq(
        "channel_id",
        channelID
      )
      .order("created_at");


  if (error) {

    console.error(
      "Message error:",
      error
    );

    return;

  }


  for (const message of messages || []) {

    addMessageToScreen(message);

  }

}


// ============================================================
// DISPLAY MESSAGE
// ============================================================

function addMessageToScreen(message) {

  const wrapper =
    document.createElement("div");


  wrapper.className =
    "message";


  const author =
    document.createElement("span");


  author.className =
    "message-author";


  author.textContent =
    message.profiles?.username ||
    message.username ||
    "User";


  const content =
    document.createElement("div");


  content.className =
    "message-content";


  content.textContent =
    message.text;


  wrapper.appendChild(author);
  wrapper.appendChild(content);


  messagesElement.appendChild(wrapper);


  messagesElement.scrollTop =
    messagesElement.scrollHeight;

}


// ============================================================
// SEND MESSAGE
// ============================================================

messageForm.onsubmit =
  async event => {

    event.preventDefault();


    if (
      !currentUser ||
      !currentChannel
    ) {

      return;

    }


    const text =
      messageInput.value.trim();


    if (!text) return;


    const { error } =
      await supabase
        .from("messages")
        .insert({
          channel_id:
            currentChannel.id,

          user_id:
            currentUser.id,

          text
        });


    if (error) {

      alert(error.message);
      return;

    }


    messageInput.value = "";

  };


// ============================================================
// CREATE SERVER INVITE
// ============================================================

document.getElementById("inviteButton").onclick =
  async () => {

    if (!currentServer) {

      alert(
        "Pick a server first."
      );

      return;

    }


    const code =
      randomCode();


    const { error } =
      await supabase
        .from("invites")
        .insert({
          code,
          server_id:
            currentServer.id,
          created_by:
            currentUser.id
        });


    if (error) {

      alert(error.message);
      return;

    }


    const link =
      window.location.origin +
      window.location.pathname +
      "?invite=" +
      code;


    document.getElementById(
      "inviteLink"
    ).value = link;


    document.getElementById(
      "invitePopup"
    ).hidden = false;

  };


// ============================================================
// COPY INVITE
// ============================================================

document.getElementById("copyInvite").onclick =
  async () => {

    const input =
      document.getElementById(
        "inviteLink"
      );


    try {

      await navigator.clipboard
        .writeText(input.value);

    } catch {

      input.select();

      document.execCommand("copy");

    }


    document.getElementById(
      "copyInvite"
    ).textContent =
      "Copied!";


    setTimeout(() => {

      document.getElementById(
        "copyInvite"
      ).textContent =
        "Copy Invite Link";

    }, 1500);

  };


// ============================================================
// CLOSE INVITE
// ============================================================

document.getElementById("closeInvite").onclick =
  () => {

    document.getElementById(
      "invitePopup"
    ).hidden = true;

  };


// ============================================================
// JOIN POPUP CANCEL
// ============================================================

document.getElementById("cancelJoin").onclick =
  () => {

    document.getElementById(
      "joinPopup"
    ).hidden = true;


    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

  };


// ============================================================
// CHECK INVITE
// ============================================================

async function checkInvite() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const code =
    params.get("invite");


  // VERY IMPORTANT:
  // No invite code = no invite popup.
  if (!code) {
    return;
  }


  if (!currentUser) {
    return;
  }


  const { data: invite, error } =
    await supabase
      .from("invites")
      .select(`
        *,
        servers(name)
      `)
      .eq(
        "code",
        code
      )
      .maybeSingle();


  if (error || !invite) {

    alert(
      "Invite not found."
    );

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );

    return;

  }


  document.getElementById(
    "joinServerName"
  ).textContent =
    "Join " +
    invite.servers.name +
    "?";


  document.getElementById(
    "joinPopup"
  ).hidden = false;


  document.getElementById(
    "joinServer"
  ).onclick =
    async () => {

      const { data, error } =
        await supabase.rpc(
          "join_server",
          {
            invite_code: code
          }
        );


      if (error) {

        alert(error.message);
        return;

      }


      document.getElementById(
        "joinPopup"
      ).hidden = true;


      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );


      await loadServers();


      const { data: server } =
        await supabase
          .from("servers")
          .select("*")
          .eq(
            "id",
            data
          )
          .single();


      if (server) {

        await selectServer(server);

      }


      alert(
        "You joined " +
        invite.servers.name +
        "!"
      );

    };

}


// ============================================================
// FRIEND SYSTEM — USERNAME
// ============================================================

document.getElementById("addFriend").onclick =
  async () => {

    if (!currentUser) {

      alert(
        "You must be logged in."
      );

      return;

    }


    const username =
      document.getElementById(
        "friendUsername"
      ).value.trim();


    if (!username) {

      alert(
        "Enter a username."
      );

      return;

    }


    const { data: friend, error } =
      await supabase
        .from("profiles")
        .select("id, username")
        .eq(
          "username",
          username
        )
        .maybeSingle();


    if (error) {

      console.error(
        "Friend lookup error:",
        error
      );

      alert(
        "Could not search for that user."
      );

      return;

    }


    if (!friend) {

      alert(
        "User not found."
      );

      return;

    }


    if (
      friend.id === currentUser.id
    ) {

      alert(
        "You can't add yourself."
      );

      return;

    }


    const { error: friendError } =
      await supabase
        .from("friends")
        .upsert({
          user_id:
            currentUser.id,

          friend_id:
            friend.id
        });


    if (friendError) {

      alert(
        friendError.message
      );

      return;

    }


    document.getElementById(
      "friendUsername"
    ).value = "";


    await loadFriends();


    alert(
      friend.username +
      " was added!"
    );

  };


// ============================================================
// LOAD FRIENDS
// ============================================================

async function loadFriends() {

  const list =
    document.getElementById(
      "friendsList"
    );


  if (!list || !currentUser) {
    return;
  }


  list.innerHTML = "";


  const { data: friends, error } =
    await supabase
      .from("friends")
      .select("friend_id")
      .eq(
        "user_id",
        currentUser.id
      );


  if (error) {

    console.error(
      "Friends error:",
      error
    );

    return;

  }


  for (const friend of friends || []) {

    const { data: profile } =
      await supabase
        .from("profiles")
        .select(
          "username, email"
        )
        .eq(
          "id",
          friend.friend_id
        )
        .maybeSingle();


    if (!profile) continue;


    const div =
      document.createElement("div");


    div.className =
      "friend";


    const name =
      document.createElement("span");


    name.className =
      "friend-name";


    name.textContent =
      profile.username ||
      "Friend";


    const call =
      document.createElement("button");


    call.className =
      "call-button";


    call.textContent =
      "📞";


    call.title =
      "Call " +
      profile.username;


    call.onclick =
      () => startCall(
        friend.friend_id
      );


    div.appendChild(name);
    div.appendChild(call);


    list.appendChild(div);

  }

}


// ============================================================
// CALL
// ============================================================

async function startCall(friendID) {

  if (!currentUser) {
    return;
  }


  const { error } =
    await supabase
      .from("calls")
      .insert({
        caller_id:
          currentUser.id,

        receiver_id:
          friendID,

        status:
          "ringing"
      });


  if (error) {

    alert(
      error.message
    );

    return;

  }


  alert(
    "Calling..."
  );

}


// ============================================================
// RANDOM INVITE CODE
// ============================================================

function randomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


  let result = "";


  for (
    let i = 0;
    i < 8;
    i++
  ) {

    result +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }


  return result;

}


// ============================================================
// VOICE
// ============================================================

function joinVoiceChannel(id, name) {

  welcomeElement.hidden = true;

  chatScreen.hidden = true;
  voiceScreen.hidden = false;


  if (voiceChannelName) {

    voiceChannelName.textContent =
      name;

  }


  const members =
    document.getElementById(
      "voiceMembers"
    );


  if (members) {

    members.innerHTML = `
      <div class="voice-member">
        🎙️
        <br>
        You
      </div>
    `;

  }

}


// ============================================================
// LEAVE VOICE
// ============================================================

document.getElementById("leaveVoice").onclick =
  () => {

    voiceScreen.hidden = true;

    if (currentServer) {
      welcomeElement.hidden = false;
    }

  };


// ============================================================
// MUTE BUTTON
// ============================================================

let muted = false;


document.getElementById("muteButton").onclick =
  () => {

    muted = !muted;


    document.getElementById(
      "muteButton"
    ).textContent =
      muted
        ? "🔇 Unmute"
        : "🎙️ Mute";

  };


// ============================================================
// START
// ============================================================

async function startApp() {

  await checkUser();


  // Only check for an invite if
  // ?invite= actually exists.
  const params =
    new URLSearchParams(
      window.location.search
    );


  if (params.get("invite")) {

    await checkInvite();

  }

}


startApp();


// ============================================================
// AUTH STATE
// ============================================================

supabase.auth.onAuthStateChange(
  async (event, session) => {

    if (
      event === "SIGNED_IN" ||
      event === "SIGNED_OUT"
    ) {

      await checkUser();


      if (session) {

        const params =
          new URLSearchParams(
            window.location.search
          );


        if (params.get("invite")) {

          await checkInvite();

        }

      }

    }

  }
);
