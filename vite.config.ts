import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({
      plugins: [["babel-plugin-react-compiler"]],
    }),
  ],
  base: "/BirdsEyeV3DataView/",
});
