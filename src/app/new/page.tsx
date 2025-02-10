"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewQuotePage() {
  return (
    <div>
      <AddForm />
    </div>
  );
}

function AddForm() {
  const router = useRouter();
  const [newQuote, setNewQuote] = useState("");

  const randomQuote = "random quote";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        // await addQuote(newQuote);
        router.push("/");
      }}
      className="flex flex-col gap-4"
    >
      <textarea
        name="quote"
        placeholder={randomQuote}
        value={newQuote}
        onChange={(e) => setNewQuote(e.target.value)}
        className="h-32 bg-gray-200 p-2 dark:bg-gray-600"
      />
      <button
        type="submit"
        disabled={newQuote.length < 5}
        className="mx-auto bg-orange-400 px-6 py-2 active:translate-y-0.5 disabled:bg-gray-200 disabled:opacity-50 md:w-64 dark:bg-amber-800 dark:disabled:bg-gray-700"
      >
        Hinzufügen
      </button>
    </form>
  );
}
