import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

// Use connectionString from environment
const connectionString = process.env.DATABASE_URL;

const db = new pg.Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }  // required on Render PostgreSQL
});


(async () => {
  try {
    await db.connect();
    console.log("Connected to DB");
  } catch (err) {
    console.error("Connection error", err);
  }
})();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


let currentUserId = 3;
let users = [];
// let users = [
//   { id: 1, name: "Angela", color: "teal" },
//   { id: 2, name: "Jack", color: "powderblue" },
// ];

async function getuser(){
  const names = await db.query("Select id,first_name,color from person")
    // let users = [];   
   users = names.rows;
  // console.log(users.find((user) => user.id == currentUserId));
  
  
  return users.find((user) => user.id == currentUserId)
}


async function checkVisisted() {

  const result = await db.query("select country_code from visit join person on person.id = visit.person_id join countries on countries.id = visit.country_id where person_id = $1" , [currentUserId]);
  let countries = [];
  result.rows.forEach((country) => {
    
     
    countries.push(country.country_code);
  });
  return countries;
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
   
     const currentuser = await  getuser();   
   
     if(currentuser == undefined || currentUserId == undefined){
          res.render("new.ejs");
     }
     else{
        res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentuser.color,

  });
     }
 
});

app.post("/add", async (req, res) => {
     console.log( "it works " + req.body);
     
    
         const input = req.body["country"];
   const currentuser = await  getuser(); 
  
   
  try {
    const result = await db.query(
      "SELECT id FROM countries WHERE LOWER(country_name) LIKE '%' || $1 ;",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.id;
     console.log(data);
     console.log(countryCode);
     
     

      if(req.body.action == 'delete'){
            try {
              await db.query(
        "  DELETE FROM visit where person_id = $1 AND country_id = $2",
        [ currentuser.id,countryCode]
      );
      res.redirect("/");
            } catch (error) {
              
            }
      }
      else{
           try {
      await db.query(
        "INSERT INTO visit (person_id,country_id) VALUES ($1,$2)",
        [ currentuser.id,countryCode]
      );
      res.redirect("/");
    } catch (err) {
      // console.log(err);
        const countries = await checkVisisted();
   
     const currentuser = await  getuser();    
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentuser.color,
      error: "Country has already been added, try again.",
  });
    }
      }
  
  } catch (err) {
    // console.log(err);
     const countries = await checkVisisted();
   
     const currentuser = await  getuser();    
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentuser.color,
    error: "Country name does not exist, try again.",
  });
  
      }
});


app.post("/user", async (req, res) => {
     
    console.log(req.body.user);
    
    
    if (req.body.add === "new") {
    res.render("new.ejs");
  } 
     else if(req.body.add === "delete"){
         res.render("delete.ejs");
     }
  else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
    
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
    
// console.log(  req.body);


  

   const result = await db.query(
  "INSERT INTO person (first_name, color) VALUES ($1, $2) RETURNING id",
  [req.body.name, req.body.color]
);


       const id = result.rows[0].id;
       console.log( "id value " + id);
       
       currentUserId = id;
        res.redirect("/");

      
});




app.post("/delete" , async(req,res) => {
       
      // console.log(res.body.name);
      

   
   
   try {
      const result =  await db.query("select id from person where first_name = $1 " , [req.body.name] );
         
        
     const currentuser =  result.rows[0]; 

      console.log("its working here " + currentuser.id);
  
  // First delete visits by that person ID
  await db.query("DELETE FROM visit WHERE person_id = $1", [currentuser.id]);

  // Then delete the person 
  await db.query("DELETE FROM person WHERE id = $1", [currentuser.id]);

          
       
      //  currentUserId = currentuser;
  res.redirect("/");
} catch (error) {
  console.error("Error deleting person and visits:", error);
  res.redirect("/");
} 
 


})


app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
