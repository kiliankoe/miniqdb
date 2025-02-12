import Navigation from "./Navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const appName = process.env.MINIQDB_NAME === "" ? "miniqdb" : process.env.MINIQDB_NAME;
  return (
    <>
      <h1 className="text-xl font-semibold text-orange-500">{appName}</h1>
      <Navigation />
      {children}
    </>
  );
}
