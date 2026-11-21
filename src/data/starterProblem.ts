export interface Problem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  entryClass: string;
  files: Record<string, string>;
}

export const STARTER_PROBLEM: Problem = {
  id: "lru-cache-bug",
  title: "Fix the Thread-Unsafe Counter",
  difficulty: "Medium",
  description:
    "The OrderService increments a shared counter across 2 threads, but the final count is sometimes lower than expected. Inspect both files, run the code to reproduce the bug, and fix the race condition in Counter.java.",
  entryClass: "Main",
  files: {
    "Counter.java": `public class Counter {
    private int count = 0;

    // BUG: Not thread-safe! Multiple threads can read/write simultaneously.
    public void increment() {
        count++;
    }

    public int getCount() {
        return count;
    }
}`,
    "Main.java": `public class Main {
    public static void main(String[] args) throws InterruptedException {
        Counter counter = new Counter();

        Thread t1 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) counter.increment();
        });
        Thread t2 = new Thread(() -> {
            for (int i = 0; i < 10000; i++) counter.increment();
        });

        t1.start();
        t2.start();
        t1.join();
        t2.join();

        int result = counter.getCount();
        System.out.println("Expected: 20000");
        System.out.println("Actual:   " + result);
        if (result != 20000) {
            System.err.println("TEST FAILED: Race condition detected!");
            System.exit(1);
        }
        System.out.println("TEST PASSED!");
    }
}`,
  },
};
