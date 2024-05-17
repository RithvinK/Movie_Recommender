//TMDB API CALL
const apiKey = 'api_key=da2496338acfa21e1bd322de778f18f5';
const apiURL = 'https://api.themoviedb.org/3/discover/movie?sort_by=popularity.desc&'+apiKey;
const imgURL = 'https://image.tmdb.org/t/p/w500';

const { MongoClient, ServerApiVersion } = require('mongodb');
const path = require("path");
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') });


const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection:process.env.MONGO_COLLECTION};
const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });


process.stdin.setEncoding("utf8");


//Style helper for Rating
const voteColor = (x) => {
    if (x >= 7.5) {
        return 'green';
    } else if (x >= 4) {
        return 'orange';
    } else {
        return 'red';
    }
};


app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
require("dotenv").config({ path: path.resolve(__dirname, '.env') });



let portNumber = 4000; 
app.listen(portNumber);
console.log(`Web server is running at http://localhost:${portNumber}`);
process.stdout.write("Type stop to shutdown the server: ");

process.stdin.on('readable', function handleInput() {
    let dataInput = process.stdin.read();
    if (dataInput !== null) {
        const command = dataInput.trim();
        if (command === "stop") {
            console.log("Shutting down the server");
            process.exit(0);
        } else {
            console.log(`Invalid command: ${command}`);
            process.stdout.write("Type stop to shutdown the server: ");
            process.stdin.read(0);
        }
    }
});

const genres = [
    {
      "id": 28,
      "name": "Action"
    },
    {
      "id": 12,
      "name": "Adventure"
    },
    {
      "id": 35,
      "name": "Comedy"
    },
    {
      "id": 80,
      "name": "Crime"
    },
    {
      "id": 18,
      "name": "Drama"
    },
    {
      "id": 14,
      "name": "Fantasy"
    },
    {
      "id": 27,
      "name": "Horror"
    },
    {
      "id": 9648,
      "name": "Mystery"
    },
    {
      "id": 10749,
      "name": "Romance"
    },
    {
      "id": 878,
      "name": "Science Fiction"
    }
  ]

app.get("/", (request, response) => {
    response.render("login");
});

app.get("/newUser", (request, response) => {
    response.render("accountRegister");
});

app.post("/newUser", (request, response) => {
    response.render("accountRegister");
});

app.use(bodyParser.urlencoded({extended:true}));

app.post("/processRegistration", async (req, res) => {
    let userData = {
        name: req.body.name,
        password: req.body.password,
        email: req.body.email,
        genre: req.body.choices,
        gender: req.body.gender
    };
    let chosenGenre = req.body.choices;
    let user;
    const genre = genres.find(g => g.name == chosenGenre);
    let id = genre.id;
    const totalURL = apiURL + '&with_genres=' + id;
    try {
        await client.connect();
        user = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).findOne({ email: userData.email });
    
        if (user) {
            return res.render("accountExists");
        }

        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(userData);

        const fetchResponse  = await fetch(totalURL);
        if (!fetchResponse.ok) {
          throw new Error(`HTTP error! status: ${fetchResponse .status}`);
        }
        const data = await fetchResponse .json();
        let movieResults = data.results;
        let totalString = '';
        let posterString = '';
        let counter = 1;

        movieResults.forEach(movie => {
            if(counter <= 10){
                const {title, poster_path, vote_average} = movie;
                totalString += `<option value="${title}">${title}</option>`;
                let titleString = `${title} - Rating: ${vote_average}`;
                posterString += 
                `
                    <div class="movie">
                        <img src="${imgURL + poster_path}" alt="${title}" title="${titleString}">
                        <div class="movieInfo">
                            <h3>${title}</h3>
                            Rating: <span class="${voteColor(vote_average.toFixed(2))}">${vote_average.toFixed(2)}</span>
                        </div>
                    </div>
                `;

            }
            counter += 1;
        });
        res.render("movieSelection", {name: totalString, poster: posterString});
        
      } catch (error) {
        console.error('Error fetching movies:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        await client.close();
    }
});



app.post("/sendChoices", async (request, response) => {
    let selectedMovies = request.body.choice;
    let movieOutput = '';

    try{
        await client.connect();
        const database = client.db(databaseAndCollection.db);
        const collection = database.collection(databaseAndCollection.collection);
        const mostRecentDocument = await collection.findOne({}, { sort: { _id: -1 } });
        const filter = { _id: mostRecentDocument._id };
        const update = {
            $set: { movies: Array.isArray(selectedMovies) ? selectedMovies : [selectedMovies] },
        };
        const result = await collection.updateOne(filter, update);
        response.render("registerComplete");
    } catch(error){
        console.error("Error occurred:", error);
    } finally{
        client.close();
    }
});

app.post("/processLogin", async (req, res) => {
    try {
        const curremail = req.body.email;
        const currpass = req.body.password;

        await client.connect();
        const database = client.db(databaseAndCollection.db);
        const collection = database.collection(databaseAndCollection.collection);
        
        const currentUser = await collection.findOne({ email: curremail, password: currpass});
        if (!currentUser) {
            return res.render("loginFailed");
        }
        const currentUserMovies = currentUser.movies;
        const allUsers = await collection.find({}).toArray();

        let tableHTML = `<table>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Gender</th>
                                <th>Matching Movies</th>
                            </tr>`;

        allUsers.forEach(user => {
            if (user.email !== curremail) {
                let matchingMovies = user.movies.filter(movie => currentUserMovies.includes(movie));   
    
                if (matchingMovies.length > 0) {
                    tableHTML += `<tr>
                                    <td>${user.name}</td>
                                    <td>${user.email}</td>
                                    <td>${user.gender}</td>
                                    <td>${matchingMovies.join(', ')}</td>
                                  </tr>`;
                }
            }
        });

        tableHTML += `</table>`;
  

        res.render("mainScreen", {tableCode: tableHTML});
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).send("Error retrieving data");
    } finally {
        await client.close();
    }
});