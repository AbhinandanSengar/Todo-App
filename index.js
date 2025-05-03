const express = require("express");
const jwt = require("jsonwebtoken");
const JWT_SECRET = "abhinandan1243";

const app = express();
app.use(express.json());

//serve CSS
app.use(express.static("public"));

let users = [];

//serve HTML
app.get('/', function(req, res) {
    res.sendFile(__dirname + "/public/index.html")
})

//Sign-Up Route
app.post('/signup', function(req, res) {
    const name = req.body.name;
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    const existingUser = users.find(user => user.email === email);
    if(existingUser) {
        res.status(401).send({
            message: "User already exists. Please sign in."
        })
        return ;
    }

    users.push({
        name: name,
        username: username,
        email: email,
        password: password,
        todos: []
    })

    res.send({
        message: "You are signed up!"
    })

    console.log(users);
})

//Sign-In Route
app.post('/signin', function(req, res) {
    const username = req.body.username;
    const password = req.body.password;

    const user = users.find(user => user.username === username && user.password === password);

    if(user) {
        const token = jwt.sign({
            username: user.username
        }, JWT_SECRET)

        user.token = token;

        res.send({
            token
        })
    } else {
        res.status(401).send({
            message: "Invalid Credentials"
        })
    }
    
    console.log(users);
})

//Authentication(auth) Middleware
function auth(req, res, next) {
    const token = req.headers.authorization;

    if(!token) {
        res.status(401).send({
            message: "Unauthorized"
        })

        return ;
    }

    try {
        const userDetails = jwt.verify(token, JWT_SECRET);
    
        if(userDetails.username) {
            req.username = userDetails.username
            return next();
        }
    } catch(err) {
        res.status(401).send({
            message: "Unauthorized"
        })
    }
}

//Profile Route
app.get('/profile', auth, function(req, res) {
    const userDetails = users.find(user => user.username === req.username);

    if(userDetails) {
        res.send({
            name: userDetails.name,
            username: userDetails.username,
            email: userDetails.email
        })
    } else {
        res.status(404).send({
            message: "Profile not found!"
        })
    }
})

//Todo Route
//Adding a Todo
app.post('/todos', auth, function(req, res) {
    const userDetails = users.find(user => user.username === req.username);
    const todoTitle = req.body.todoTitle;

    if(!todoTitle) {
        res.status(400).send({
            message: "Please enter a new todo"
        });
        return;
    }

    const todo = {
        id: Date.now(),
        todoTitle,
        completed: false
    }

    userDetails.todos.push(todo);

    res.send({
        message: "Todo added!", todo
    })
})

//Getting a Todo
app.get('/todos', auth, function(req, res) {
    const userDetails = users.find(user => user.username === req.username);

    res.send({
        todos: userDetails.todos
    })
})

//marking a Todo as DONE
app.put('/todos/:id/done', auth, function(req, res) {
    const userDetails = users.find(user => user.username === req.username);
    const todo = userDetails.todos.find(td => td.id === Number(req.params.id));

    if(!todo) {
        res.status(404).send({
            message: "Todo not found"
        });
        return;
    }

    todo.completed = true;

    res.send({
        message: "Marked as DONE!", todo
    })
})

app.delete('/todos/:id', auth, function(req, res) {
    const userDetails = users.find(user => user.username === req.username);
    const todoId = userDetails.todos.findIndex(todo => todo.id === Number(req.params.id));

    if(todoId === -1) {
        res.status(404).send({
            message: "Todo not found"
        })
        return;
    }

    userDetails.todos.splice(todoId, 1);

    res.send({
        message: "Todo deleted!"
    })
})

app.listen(3000);