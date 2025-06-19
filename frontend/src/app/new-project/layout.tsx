import Navigation from "@/components/Navigation";

export default function NewProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <div className="md:pl-64">
        {children}
      </div>
    </div>
  );
}
