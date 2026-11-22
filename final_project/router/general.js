const express = require('express');
const axios = require('axios');
let books = require("./booksdb.js");
let isValid = require("./auth_users.js").isValid;
let users = require("./auth_users.js").users;
const public_users = express.Router();

const BASE_URL = process.env.BOOKSHOP_URL || "http://localhost:5000";

// ---------------------------------------------------------------------------
// Data helpers (Promise based, so the routes and the Axios client share logic)
// ---------------------------------------------------------------------------

const withIsbn = (isbn) => ({ isbn, ...books[isbn] });

const findBooksBy = (field, value) =>
  Object.keys(books)
    .filter((isbn) => books[isbn][field].toLowerCase() === String(value).toLowerCase())
    .map(withIsbn);

const getAllBooksData = () => new Promise((resolve) => resolve(books));

const getBookByIsbnData = (isbn) =>
  new Promise((resolve, reject) => {
    if (books[isbn]) {
      resolve(books[isbn]);
    } else {
      reject(new Error(`Book with ISBN ${isbn} not found`));
    }
  });

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

public_users.post("/register", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  if (!isValid(username)) {
    return res.status(409).json({ message: "User already exists" });
  }

  users.push({ username, password });
  return res.status(201).json({ message: "User successfully registered. Now you can login" });
});

// Get the book list available in the shop
public_users.get('/', (req, res) => {
  getAllBooksData().then((allBooks) => res.status(200).send(JSON.stringify(allBooks, null, 4)));
});

// Get book details based on ISBN
public_users.get('/isbn/:isbn', (req, res) => {
  getBookByIsbnData(req.params.isbn)
    .then((book) => res.status(200).json(book))
    .catch((err) => res.status(404).json({ message: err.message }));
});

// Get book details based on author
public_users.get('/author/:author', (req, res) => {
  const result = findBooksBy("author", req.params.author);
  if (result.length === 0) {
    return res.status(404).json({ message: `No books found for author ${req.params.author}` });
  }
  return res.status(200).json({ booksbyauthor: result });
});

// Get all books based on title
public_users.get('/title/:title', (req, res) => {
  const result = findBooksBy("title", req.params.title);
  if (result.length === 0) {
    return res.status(404).json({ message: `No books found with title ${req.params.title}` });
  }
  return res.status(200).json({ booksbytitle: result });
});

// Get book review
public_users.get('/review/:isbn', (req, res) => {
  const book = books[req.params.isbn];
  if (!book) {
    return res.status(404).json({ message: `Book with ISBN ${req.params.isbn} not found` });
  }
  return res.status(200).json(book.reviews);
});

// ---------------------------------------------------------------------------
// Axios client functions: call the routes above over HTTP.
// Mounted under /async/* so they can be exercised against the running server.
// ---------------------------------------------------------------------------

// Promise callbacks
const getAllBooks = () =>
  axios.get(`${BASE_URL}/`).then((response) => response.data);

// async/await
const getBookByISBN = async (isbn) => {
  const response = await axios.get(`${BASE_URL}/isbn/${encodeURIComponent(isbn)}`);
  return response.data;
};

const getBooksByAuthor = async (author) => {
  const response = await axios.get(`${BASE_URL}/author/${encodeURIComponent(author)}`);
  return response.data;
};

const getBooksByTitle = async (title) => {
  const response = await axios.get(`${BASE_URL}/title/${encodeURIComponent(title)}`);
  return response.data;
};

const sendAxiosError = (res, error) => {
  if (error.response) {
    return res.status(error.response.status).json(error.response.data);
  }
  return res.status(500).json({ message: error.message });
};

public_users.get('/async/books', (req, res) => {
  getAllBooks()
    .then((data) => res.status(200).json(data))
    .catch((error) => sendAxiosError(res, error));
});

public_users.get('/async/isbn/:isbn', async (req, res) => {
  try {
    return res.status(200).json(await getBookByISBN(req.params.isbn));
  } catch (error) {
    return sendAxiosError(res, error);
  }
});

public_users.get('/async/author/:author', async (req, res) => {
  try {
    return res.status(200).json(await getBooksByAuthor(req.params.author));
  } catch (error) {
    return sendAxiosError(res, error);
  }
});

public_users.get('/async/title/:title', async (req, res) => {
  try {
    return res.status(200).json(await getBooksByTitle(req.params.title));
  } catch (error) {
    return sendAxiosError(res, error);
  }
});

module.exports.general = public_users;
module.exports.getAllBooks = getAllBooks;
module.exports.getBookByISBN = getBookByISBN;
module.exports.getBooksByAuthor = getBooksByAuthor;
module.exports.getBooksByTitle = getBooksByTitle;
