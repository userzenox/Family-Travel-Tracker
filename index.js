import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config();

const app = express();
const port = 3000;

// ---------- DB SETUP ----------
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;
const connectionString = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}`;
const db = neon(connectionString);   // db is a tagged-template function

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 3;
let users = [];

// ---------- HELPERS ----------

async function getuser() {
  const rows = await db`SELECT id, first_name, color FROM person`;
  users = rows;                                  // rows is already an array
  return users.find((user) => user.id == currentUserId);
}

async function checkVisited() {
  const rows = await db`
    SELECT country_code
    FROM visit
    JOIN person    ON person.id    = visit.person_id
    JOIN countries ON countries.id = visit.country_id
    WHERE person_id = ${currentUserId};
  `;
  const countries = [];
  rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

// ---------- ROUTES ----------

app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentuser = await getuser();

  if (!currentuser || !currentUserId) {
    res.render("new.ejs");
  } else {
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentuser.color,
    });
  }
});

app.post("/add", async (req, res) => {
  console.log("it works ", req.body);

  const input = req.body["country"];
  const currentuser = await getuser();

  try {
    const rows = await db`
      SELECT id
      FROM countries
      WHERE LOWER(country_name) LIKE '%' || ${input.toLowerCase()};
    `;
    const data = rows[0];
    const countryCode = data.id;
    console.log(data);
    console.log(countryCode);

    if (req.body.action === "delete") {
      try {
        await db`
          DELETE FROM visit
          WHERE person_id = ${currentuser.id} AND country_id = ${countryCode};
        `;
        res.redirect("/");
      } catch (error) {
        console.error(error);
        res.redirect("/");
      }
    } else {
      try {
        await db`
          INSERT INTO visit (person_id, country_id)
          VALUES (${currentuser.id}, ${countryCode});
        `;
        res.redirect("/");
      } catch (err) {
        const countries = await checkVisited();
        const currentuser2 = await getuser();
        res.render("index.ejs", {
          countries: countries,
          total: countries.length,
          users: users,
          color: currentuser2.color,
          error: "Country has already been added, try again.",
        });
      }
    }
  } catch (err) {
    const countries = await checkVisited();
    const currentuser2 = await getuser();
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentuser2.color,
      error: "Country name does not exist, try again.",
    });
  }
});

app.post("/user", async (req, res) => {
  console.log(req.body.user);

  if (req.body.add === "new") {
    res.render("new.ejs");
  } else if (req.body.add === "delete") {
    res.render("delete.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const rows = await db`
    INSERT INTO person (first_name, color)
    VALUES (${req.body.name}, ${req.body.color})
    RETURNING id;
  `;
  const id = rows[0].id;
  console.log("id value " + id);

  currentUserId = id;
  res.redirect("/");
});

app.post("/delete", async (req, res) => {
  try {
    const rows = await db`
      SELECT id FROM person WHERE first_name = ${req.body.name};
    `;
    const currentuser = rows[0];

    console.log("its working here " + currentuser.id);

    await db`DELETE FROM visit WHERE person_id = ${currentuser.id};`;
    await db`DELETE FROM person WHERE id = ${currentuser.id};`;

    res.redirect("/");
  } catch (error) {
    console.error("Error deleting person and visits:", error);
    res.redirect("/");
  }
});

// ---------- START SERVER ----------

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
