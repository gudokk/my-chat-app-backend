const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Function to read data from file
const readData = () => {
  try {
    // Check if the file exists, if not create it with initial data
    if (!fs.existsSync("data.json")) {
      fs.writeFileSync(
        "data.json",
        JSON.stringify({ users: [], channels: [] }, null, 2)
      );
    }

    // Read the data from the file
    const data = fs.readFileSync("data.json", "utf8");
    // If the data is empty, write initial data to the file
    if (!data.trim()) {
      fs.writeFileSync(
        "data.json",
        JSON.stringify({ users: [], channels: [] }, null, 2)
      );
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading or parsing data file:", error);
    return { users: [], channels: [] }; // Return empty data if an error occurs
  }
};

// Function to write data to file
const writeData = (data) => {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
};

// Route to get all users
app.get("/users", (req, res) => {
  const data = readData();
  res.json(data.users);
});

const bcrypt = require("bcrypt");
const saltRounds = 10;

// Route to register a new user
app.post("/register", async (req, res) => {
  const data = readData();
  const { username, email, password } = req.body;

  // Check if the user already exists
  if (data.users.find((user) => user.username === username)) {
    return res.status(400).send("User already exists");
  }

  // Hash the password before saving it
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newUser = {
    id: data.users.length + 1,
    username,
    email,
    password: hashedPassword,
    avatar: "https://example.com/default-avatar.jpg",
    channels: [],
  };

  data.users.push(newUser);
  writeData(data);

  res.status(201).send("User created");
});

// Route to log in a user
app.post("/login", async (req, res) => {
  const data = readData();
  const { username, password } = req.body;

  const user = data.users.find((user) => user.username === username);
  if (!user) {
    return res.status(400).send("User not found");
  }

  // Compare the entered password with the stored hashed password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).send("Invalid password");
  }

  res.status(200).send("Login successful");
});

// Route to get all channels
app.get("/channels", (req, res) => {
  const data = readData();
  res.json(data.channels);
});

// Route to create a new channel
app.post("/channel", (req, res) => {
  const data = readData();
  const { name, users, creator } = req.body;

  const updatedUsers = users.map((username, index) => ({
    id: index + 1,
    username,
    messages: [],
  }));

  const newChannel = {
    id: data.channels.length + 1,
    name,
    users: [...updatedUsers],
    creator,
  };

  data.channels.push(newChannel);
  writeData(data);

  res.status(201).json(newChannel);
});

// Route to get a specific channel by id
app.get("/channel/:id", (req, res) => {
  const data = readData();
  const channel = data.channels.find(
    (channel) => channel.id === parseInt(req.params.id)
  );

  if (!channel) {
    return res.status(404).send("Channel not found");
  }

  // Combine messages from all users in the channel
  let allMessages = [];
  channel.users.forEach((user) => {
    allMessages = [...allMessages, ...user.messages];
    // Merge all user messages
  });
  // Send the channel data with all messages
  res.json({ ...channel, messages: allMessages });
});

// Route for a user to join a channel
app.post("/channel/:id/join", (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  const data = readData();
  const channel = data.channels.find((channel) => channel.id === parseInt(id));

  if (!channel) {
    return res.status(404).send("Channel not found");
  }

  // Check if the user is already in the channel
  if (channel.users.some((user) => user.username === username)) {
    return res.status(400).send("User already in the channel");
  }

  // Generate a new id for the user
  const newUserId = channel.users.length + 1;

  // Add the new user to the channel
  channel.users.push({
    id: newUserId,
    username: username,
    messages: [],
  });

  writeData(data);

  res.status(200).json(channel);
});

// Route to remove a user from a channel
app.post("/channel/:id/remove-user", (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  const data = readData();
  const channel = data.channels.find((channel) => channel.id === parseInt(id));

  if (!channel) {
    return res.status(404).send("Channel not found");
  }

  channel.users = channel.users.filter((user) => user.username !== username);
  writeData(data);

  res.status(200).json(channel); // Send the updated channel data
});

// Route to send a message in a channel
app.post("/channel/:id/message", (req, res) => {
  const { id } = req.params;
  const { username, text } = req.body;

  const data = readData();
  const channel = data.channels.find((channel) => channel.id === parseInt(id));

  if (!channel) {
    return res.status(404).send("Channel not found");
  }
  const user = channel.users.find((user) => user.username === username);
  if (!user) {
    return res.status(404).send("User not found in the channel");
  }

  const newMessage = {
    id: user.messages.length + 1,
    username,
    text,
    timestamp: new Date().toISOString(),
  };

  user.messages.push(newMessage);
  writeData(data);

  // Collect all messages from all users in the channel
  let allMessages = [];
  channel.users.forEach((user) => {
    allMessages = [...allMessages, ...user.messages];
  });

  // Sort all messages by timestamp
  allMessages.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Send all sorted messages as the response
  res.status(201).json({ messages: allMessages });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
