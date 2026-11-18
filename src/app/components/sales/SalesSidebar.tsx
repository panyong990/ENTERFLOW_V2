import { Sidebar } from "../Sidebar";

export function SalesSidebar(props: Omit<React.ComponentProps<typeof Sidebar>, "role">) {
  return <Sidebar {...props} role="sales" />;
}
