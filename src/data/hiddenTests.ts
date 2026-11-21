// SERVER-ONLY FILE: Isko sirf /api/run/route.ts mein import karna hai. Browser ko ye kabhi nahi dikhega!

export interface HiddenTestConfig {
  entryClass: string;
  testFiles: Record<string, string>;
}

export const HIDDEN_TESTS: Record<string, HiddenTestConfig> = {
  "inventory-race-condition": {
    entryClass: "com.debugrep.HiddenGrader",
    testFiles: {
      "src/test/java/com/debugrep/HiddenGrader.java": `package com.debugrep;

import com.debugrep.model.Inventory;
import com.debugrep.service.OrderService;
import java.util.concurrent.atomic.AtomicInteger;

public class HiddenGrader {
    public static void main(String[] args) throws InterruptedException {
        int initialStock = 100;
        int totalBuyers = 150;

        Inventory inventory = new Inventory(initialStock);
        OrderService orderService = new OrderService(inventory);
        AtomicInteger successfulOrders = new AtomicInteger(0);

        Thread[] threads = new Thread[totalBuyers];
        for (int i = 0; i < totalBuyers; i++) {
            threads[i] = new Thread(() -> {
                if (orderService.placeOrder()) {
                    successfulOrders.incrementAndGet();
                }
            });
            threads[i].start();
        }

        for (Thread t : threads) {
            t.join();
        }

        int finalStock = orderService.getRemainingStock();
        int orders = successfulOrders.get();

        System.out.println("Initial Stock:     " + initialStock);
        System.out.println("Total Buyers:      " + totalBuyers);
        System.out.println("Successful Orders: " + orders);
        System.out.println("Remaining Stock:   " + finalStock);

        if (orders != initialStock || finalStock != 0) {
            System.err.println("TEST FAILED: Expected exactly " + initialStock + " orders and 0 remaining stock!");
            System.exit(1);
        }

        System.out.println("ALL HIDDEN TESTS PASSED!");
    }
}
`,
    },
  },
};
