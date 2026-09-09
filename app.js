import { createClient } from
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://swlpnetfbbepduapkawc.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_X35avJuVQ_TUFwp-cr0xMA_cyQQB_HK";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
// ============================================================
// FRIENDCALL APP
// ============================================================

let currentUser = null;
let currentServer = null;
let currentChannel = null;
let messageSubscription = null;


// ------------------------------------------------------------
// ELEMENTS
// ------------------------------------------------------------

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("app");

const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const authError = document.getElementById("authError");


// ------------------------------------------------------------
// SIGN UP
// ------------------------------------------------------------

document.getElementById("signup").onclick = async () => {

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username || !email || !password) {
        authError.textContent = "Fill in everything.";
        return;
    }

    if (password.length < 6) {
        authError.textContent =
            "Password needs at least 6 characters.";
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
        authError.textContent = error.message;
        return;
    }

    if (data.user) {

        await supabase
            .from("profiles")
            .insert({
                id: data.user.id,
                username: username,
                email: email
            });

        alert("Account created!");
    }
};


// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------

document.getElementById("login").onclick = async () => {

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const { error } =
        await supabase.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        authError.textContent = error.message;
    }
};


// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------

document.getElementById("logout").onclick = async () => {

    await supabase.auth.signOut();

};


// ------------------------------------------------------------
// CHECK LOGIN
// ------------------------------------------------------------

async function checkUser() {

    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) {

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
    await checkInvite();
}


// ------------------------------------------------------------
// PROFILE
// ------------------------------------------------------------

async function loadProfile() {

    const { data } =
        await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

    if (!data) return;

    document.getElementById(
        "currentUser"
    ).textContent = data.username;

}


// ------------------------------------------------------------
// CREATE SERVER
// ------------------------------------------------------------

document.getElementById("createServer").onclick =
    async () => {

        const name =
            prompt("Server name:");

        if (!name) return;

        const { data: server, error } =
            await supabase
                .from("servers")
                .insert({
                    name: name,
                    owner_id: currentUser.id
                })
                .select()
                .single();

        if (error) {
            alert(error.message);
            return;
        }

        // Add creator as member
        await supabase
            .from("server_members")
            .insert({
                server_id: server.id,
                user_id: currentUser.id
            });


        // General text channel
        await supabase
            .from("channels")
            .insert({
                server_id: server.id,
                name: "general",
                type: "text"
            });


        // General voice channel
        await supabase
            .from("channels")
            .insert({
                server_id: server.id,
                name: "General",
                type: "voice"
            });


        await loadServers();

        selectServer(server);

    };


// ------------------------------------------------------------
// LOAD SERVERS
// ------------------------------------------------------------

async function loadServers() {

    const { data: memberships } =
        await supabase
            .from("server_members")
            .select("server_id")
            .eq("user_id", currentUser.id);

    serversElement.innerHTML = "";

    if (!memberships) return;


    for (const membership of memberships) {

        const { data: server } =
            await supabase
                .from("servers")
                .select("*")
                .eq("id", membership.server_id)
                .single();

        if (!server) continue;


        const button =
            document.createElement("div");

        button.className = "server";

        button.textContent =
            server.name
                .substring(0, 2)
                .toUpperCase();

        button.title = server.name;

        button.onclick = () => {
            selectServer(server);
        };

        serversElement.appendChild(button);
    }
}


// ------------------------------------------------------------
// SELECT SERVER
// ------------------------------------------------------------

async function selectServer(server) {

    currentServer = server;

    serverNameElement.textContent =
        server.name;

    welcomeElement.hidden = true;

    await loadChannels();
}


// ------------------------------------------------------------
// LOAD CHANNELS
// ------------------------------------------------------------

async function loadChannels() {

    textChannelsElement.innerHTML = "";
    voiceChannelsElement.innerHTML = "";

    const { data: channels, error } =
        await supabase
            .from("channels")
            .select("*")
            .eq("server_id", currentServer.id)
            .order("created_at");

    if (error) {
        console.error(error);
        return;
    }


    for (const channel of channels) {

        const button =
            document.createElement("div");

        button.className = "channel";


        if (channel.type === "voice") {

            button.classList.add("voice");

            button.textContent =
                "🔊 " + channel.name;

            button.onclick = () => {

                joinVoiceChannel(
                    channel.id,
                    channel.name
                );

            };

            voiceChannelsElement.appendChild(button);

        } else {

            button.textContent =
                "# " + channel.name;

            button.onclick = () => {

                openTextChannel(
                    channel.id,
                    channel.name
                );

            };

            textChannelsElement.appendChild(button);

        }
    }
}


// ------------------------------------------------------------
// ADD TEXT CHANNEL
// ------------------------------------------------------------

document.getElementById("addTextChannel").onclick =
    async () => {

        if (!currentServer) {
            alert("Pick a server first.");
            return;
        }

        const name =
            prompt("Channel name:");

        if (!name) return;

        await supabase
            .from("channels")
            .insert({
                server_id: currentServer.id,
                name: name,
                type: "text"
            });

        loadChannels();
    };


// ------------------------------------------------------------
// ADD VOICE CHANNEL
// ------------------------------------------------------------

document.getElementById("addVoiceChannel").onclick =
    async () => {

        if (!currentServer) {
            alert("Pick a server first.");
            return;
        }

        const name =
            prompt("Voice channel name:");

        if (!name) return;

        await supabase
            .from("channels")
            .insert({
                server_id: currentServer.id,
                name: name,
                type: "voice"
            });

        loadChannels();
    };


// ------------------------------------------------------------
// OPEN TEXT CHANNEL
// ------------------------------------------------------------

async function openTextChannel(id, name) {

    currentChannel = {
        id,
        name
    };

    chatScreen.hidden = false;
    voiceScreen.hidden = true;

    channelNameElement.textContent =
        "# " + name;


    if (messageSubscription) {
        await supabase.removeChannel(
            messageSubscription
        );
    }


    await loadMessages(id);


    messageSubscription =
        supabase
            .channel("messages-" + id)
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


// ------------------------------------------------------------
// LOAD MESSAGES
// ------------------------------------------------------------

async function loadMessages(channelID) {

    messagesElement.innerHTML = "";

    const { data: messages } =
        await supabase
            .from("messages")
            .select(`
                *,
                profiles(username)
            `)
            .eq("channel_id", channelID)
            .order("created_at");


    if (!messages) return;


    for (const message of messages) {

        addMessageToScreen(message);

    }
}


// ------------------------------------------------------------
// DISPLAY MESSAGE
// ------------------------------------------------------------

function addMessageToScreen(message) {

    const wrapper =
        document.createElement("div");

    wrapper.className = "message";


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


// ------------------------------------------------------------
// SEND MESSAGE
// ------------------------------------------------------------

messageForm.onsubmit = async event => {

    event.preventDefault();

    if (!currentChannel) return;

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

                text: text
            });


    if (error) {
        console.error(error);
        return;
    }


    messageInput.value = "";
};


// ------------------------------------------------------------
// CREATE INVITE
// ------------------------------------------------------------

document.getElementById("inviteButton").onclick =
    async () => {

        if (!currentServer) {
            alert("Pick a server first.");
            return;
        }

        const code =
            randomCode();


        const { error } =
            await supabase
                .from("invites")
                .insert({
                    code: code,
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


// ------------------------------------------------------------
// COPY INVITE
// ------------------------------------------------------------

document.getElementById("copyInvite").onclick =
    async () => {

        const input =
            document.getElementById("inviteLink");

        await navigator.clipboard.writeText(
            input.value
        );

        document.getElementById(
            "copyInvite"
        ).textContent = "Copied!";

        setTimeout(() => {

            document.getElementById(
                "copyInvite"
            ).textContent =
                "Copy Invite Link";

        }, 1500);
    };


// ------------------------------------------------------------
// CLOSE INVITE
// ------------------------------------------------------------

document.getElementById("closeInvite").onclick =
    () => {

        document.getElementById(
            "invitePopup"
        ).hidden = true;

    };


// ------------------------------------------------------------
// JOIN INVITE
// ------------------------------------------------------------

async function checkInvite() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code =
        params.get("invite");

    if (!code) return;


    const { data: invite } =
        await supabase
            .from("invites")
            .select(`
                *,
                servers(name)
            `)
            .eq("code", code)
            .single();


    if (!invite) {

        alert("Invite not found.");
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
    ).onclick = async () => {

        const { error } =
            await supabase
                .from("server_members")
                .upsert({
                    server_id:
                        invite.server_id,

                    user_id:
                        currentUser.id
                });


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


        alert(
            "You joined " +
            invite.servers.name +
            "!"
        );
    };
}


// ------------------------------------------------------------
// FRIENDS
// ------------------------------------------------------------

document.getElementById("addFriend").onclick =
    async () => {

        const email =
            document.getElementById(
                "friendEmail"
            ).value
            .trim()
            .toLowerCase();

        if (!email) return;


        const { data: friend } =
            await supabase
                .from("profiles")
                .select("*")
                .eq("email", email)
                .single();


        if (!friend) {

            alert("User not found.");
            return;

        }


        if (friend.id === currentUser.id) {

            alert("You can't add yourself.");
            return;

        }


        await supabase
            .from("friends")
            .upsert({
                user_id:
                    currentUser.id,

                friend_id:
                    friend.id
            });


        document.getElementById(
            "friendEmail"
        ).value = "";


        await loadFriends();


        alert("Friend added!");
    };


// ------------------------------------------------------------
// LOAD FRIENDS
// ------------------------------------------------------------

async function loadFriends() {

    const { data: friends } =
        await supabase
            .from("friends")
            .select(`
                friend_id,
                profiles!friends_friend_id_fkey(
                    username,
                    email
                )
            `)
            .eq(
                "user_id",
                currentUser.id
            );


    const list =
        document.getElementById(
            "friendsList"
        );

    list.innerHTML = "";


    if (!friends) return;


    for (const friend of friends) {

        const div =
            document.createElement("div");

        div.className = "friend";


        const name =
            document.createElement("span");

        name.className =
            "friend-name";

        name.textContent =
            friend.profiles?.username ||
            friend.profiles?.email ||
            "Friend";


        const call =
            document.createElement("button");

        call.className =
            "call-button";

        call.textContent = "📞";


        call.onclick = () => {

            startCall(
                friend.friend_id
            );

        };


        div.appendChild(name);
        div.appendChild(call);

        list.appendChild(div);
    }
}


// ------------------------------------------------------------
// CALL
// ------------------------------------------------------------

async function startCall(friendID) {

    const { error } =
        await supabase
            .from("calls")
            .insert({
                caller_id:
                    currentUser.id,

                receiver_id:
                    friendID,

                status: "ringing"
            });


    if (error) {

        alert(error.message);
        return;

    }


    alert("Calling...");
}


// ------------------------------------------------------------
// RANDOM INVITE CODE
// ------------------------------------------------------------

function randomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 8; i++) {

        result += chars[
            Math.floor(
                Math.random() *
                chars.length
            )
        ];

    }

    return result;
}


// ------------------------------------------------------------
// VOICE PLACEHOLDER
// ------------------------------------------------------------

function joinVoiceChannel(id, name) {

    chatScreen.hidden = true;
    voiceScreen.hidden = false;

    voiceChannelName.textContent =
        name;

    document.getElementById(
        "voiceMembers"
    ).innerHTML = `
        <div class="voice-member">
            🎙️
            <br>
            You
        </div>
    `;

    /*
      WebRTC voice is added in the next file.
    */
}


// ------------------------------------------------------------
// START
// ------------------------------------------------------------

checkUser();


// Keep login state updated
supabase.auth.onAuthStateChange(
    async () => {
        await checkUser();
    }
);
