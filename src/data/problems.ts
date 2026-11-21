// PUBLIC FILE: Ye browser mein jayega, isliye isme koi bhi hidden test ya answer nahi rakhna hai!

export interface Problem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  files: Record<string, string>; // Virtual File System (nested folder paths as keys)
}

export const PROBLEMS: Problem[] = [
  {
    id: "inventory-race-condition",
    title: "Overselling Inventory Under Load",
    difficulty: "Medium",
    description:
      "During a flash sale, multiple checkout threads call OrderService.placeOrder() simultaneously. Even though only 100 items are in stock, the system is overselling and leaving stock inconsistent. Inspect the repository and fix the concurrency bug.",
    files: {
      "src/main/java/com/debugrep/model/Inventory.java": `package com.debugrep.model;

public class Inventory {
    private int stock;

    public Inventory(int initialStock) {
        this.stock = initialStock;
    }

    // BUG: Check-then-act race condition! Multiple threads can read stock > 0 at the exact same time.
    public boolean reserveItem() {
        if (stock > 0) {
            // Simulate tiny processing delay to expose the race condition
            try { Thread.sleep(1); } catch (InterruptedException ignored) {}
            stock--;
            return true;
        }
        return false;
    }

    public int getStock() {
        return stock;
    }
}
`,
      "src/main/java/com/debugrep/service/OrderService.java": `package com.debugrep.service;

import com.debugrep.model.Inventory;

public class OrderService {
    private final Inventory inventory;

    public OrderService(Inventory inventory) {
        this.inventory = inventory;
    }

    public boolean placeOrder() {
        return inventory.reserveItem();
    }

    public int getRemainingStock() {
        return inventory.getStock();
    }
}
`,
    },
  },
];
