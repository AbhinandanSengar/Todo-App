const bcrypt = require("bcrypt");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose")
const { UserModel, TodoModel } = require("./db")
const JWT_SECRET = "abhi1w2wdwqd3";
const { z } = require("zod");

//DB connection
mongoose.connect("mongodb+srv://abhinandansengar:g20lQiTM4uEMhj81@cluster0.tdhzf10.mongodb.net/todo-app-database");

const app = express();
app.use(express.json());

//serving FE on the same port as backend
app.get('/', function(req, res){
    res.sendFile(__dirname + "/public/index.html");
})

//rendering CSS
app.use(express.static("public"));

//Signup Route
app.post('/signup', async function(req, res) {
    const requiredBody = z.object({
        name: z.string(),
        email: z.string()
            .email({ message: "Invalid email address" }),
        password: z.string()
            .min(8, { message: "Minimum 8 chracters" })
            .max(32, { message: "Maximum 32 chracters" })
    });

    const parsedData = requiredBody.safeParse(req.body);

    if(!parsedData.success) {
        return res.status(400).json({
            message: "Incorrect format",
            error: parsedData.error
        });
    }

    const { name, email, password } = parsedData.data;

    try {
        const existingUser = await UserModel.findOne({ email });
        if(existingUser) {
            return res.status(400).send({
                message: "user already exists"
            });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        await UserModel.create({
            name: name,
            email: email,
            password: hashPassword
        });

        res.status(201).send({
            message: "You are signed up!"
        });
    } catch(error) {
        console.error("Signup error:", error)
        res.status(500).send({
            message: "Internal server error",
            error: error.message
        });
    }
});

//Signin Route
app.post('/signin', async function(req, res) {
    const requiredBody = z.object({
        email: z.string()
            .email({ message: "Invalid email address" }),
        password: z.string()
            .min(8, { message: "Minimum 8 characters "})
            .max(32, { message: "Maximum 32 characters "})
    });

    const parsedData = requiredBody.safeParse(req.body);
    if(!parsedData.success) {
        return res.status(400).send({
            message: "Incorrect format",
            error: parsedData.error
        })
    }
    
    const { email, password } = parsedData.data;
    
    try {
        const user = await UserModel.findOne({ email });
        if(!user) {
            return res.status(403).send({
                message: "Invalid credentials"
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if(!passwordMatch) {
            return res.status(403).send({
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign({
            id: user._id.toString()
        }, JWT_SECRET, {
            expiresIn: "1h"
        });
    
        res.status(200).send({
            message: "Signed in successfully",
            token: token
        });
    } catch(error) {
        console.error("Signin error:", error)
        res.send({
            message: "Internal server error",
            error: error.message
        });
    }
});

//auth middleware
function auth(req, res, next) {
    const token = req.headers.authorization;

    if(!token) {
        res.status(400).send({
            message: "AUthorization token is missing"
        });
    }

    try {
        const decodedData = jwt.verify(token, JWT_SECRET);
    
        if(!decodedData) {
            return res.status(404).send({
                message: "User not found"
            })
        } else {
            req.userId = decodedData.id;
            next();
        }
    } catch(error) {
        return res.status(401).send({
            message: "Token invalid or expired",
            error: error.message
        })
    }
}

//profile Route
app.get("/", auth, function(req, res) {
    
})

//creating a Todo
app.post('/todos', auth, async function(req, res) {
    const requiredTodoSchema = z.object({
        title: z.string()
            .min(1, { message: "title is required" }),
        done: z.boolean().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.string().optional()
    })

    const parsedData = requiredTodoSchema.safeParse(req.body);
    if(!parsedData.success) {
        return res.status(400).json({
            message: "Invalid input",
            error: parsedData.error
        });
    }

    const { title, done = false, priority = "medium", dueDate } = parsedData.data;
    const userId = req.userId;

    try {
        const parsedDueData = dueDate ? new Date(dueDate) : null;

        const newTodo = await TodoModel.create({
            title,
            done,
            priority,
            dueDate: parsedDueData,
            userId
        });

        newTodo.updatedAt = new Date();
        await newTodo.save();
    
        res.status(201).send({
            message: "Todo created successfully",
            todo: newTodo
        });
    } catch(error) {
        console.error("Create ToDo error:", error)
        return res.status(500).send({
            message: "Something went wrong",
            error: error.message
        });
    }
});

//fetching all todos
app.get('/todos', auth, async function(req, res) {
    const userId = req.userId;

    try {
        const todos = await TodoModel.find({
            userId: userId
        }).sort({
            createdAt: -1
        });

        res.status(200).json({
            todos
        });
    } catch(error) {
        console.error("Fetching ToDo error:", error);
        res.status(500).send({
            message: "Something went wrong",
            error: error.message
        })
    }
});

//marking a TODO as done
app.put('/todos/:id/done', auth, async function(req, res) {
    const userId = req.userId;
    const todoId = req.params.id;

    try {
        const todo = await TodoModel.findOne({
            _id: todoId,
            userId: userId
        });
    
        if(!todo) {
            return res.status(404).send({
                message: "TODO not found!"
            });
        }

        if(todo.done) {
            return res.status(400).send({
                message: "Todo is already marked as done"
            });
        }

        todo.done = true;
        todo.completedAt = new Date();
        todo.updatedAt = new Date();
        await todo.save();

        res.status(200).send({
            message: "Todo marked as done!",
            todo
        });
    } catch(error) {
        console.error("Mark done error:", error)
        res.status(500).send({
            message: "Something went wrong!",
            error: error.message
        });
    }
});

//deleting a TODO
app.delete('/todos/:id', auth, async function(req, res) {
    const userId = req.userId;
    const todoId = req.params.id;

    try {
        const deletedTodo = await TodoModel.findOneAndDelete({
            _id: todoId,
            userId: userId
        });

        if(!deletedTodo) {
            return res.status(404).send({
                message: "Todo not found"
            });
        }

        res.status(200).send({
            message: "Todo deleted successfully",
            todo: deletedTodo
        });
    } catch(error) {
        console.error("Delete Todo error:", error);
        res.status(500).send({
            message: "Something went wrong",
            error: error.message
        });
    } 
});

app.listen(3000);