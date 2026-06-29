import { Redirect } from "expo-router";

// La app entra directo a las tabs (el contenido público no requiere login).
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
