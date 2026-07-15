// import Dexie from "dexie";
// // Create (or open) a database named "ProductDB"
// export const db = new Dexie("ProductDB");
// // Define the database schema (tables and fields)
// db.version(1).stores({
// // Table name: 'products'
// // ++id means auto-increment primary key
// products: "++id, name, category, price, quantity, description",
// quiztable: "++projectid,,skills"
// });

import Dexie from "dexie";

// Create database
export const db = new Dexie("ProductDB");

// Define tables
db.version(1).stores({
  products: "++id, name, categoryId, price, quantity, description,image",
  categories: "++id, name",
  users: "++id, username, email, password, role",
  students: "++id, name, aridNumber, section, parentName",
  sections: "++id, name, class, section",
  assignments: "++id, teacherId, subject, class, section, email"
});

// Seed categories if not exist
async function seedCategories() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd([
      { name: "Electronics" },
      { name: "Groceries" },
      { name: "Clothing" },
      { name: "Stationery" },
      { name: "Beverages" }
    ]);
    console.log("Categories seeded successfully!");
  }
}

seedCategories();
