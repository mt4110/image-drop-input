import { ExampleApp } from '../../shared/ExampleApp';

export function App() {
  return (
    <ExampleApp
      consumerName="Vite consumer example"
      uploadKey="example/vite/cover-image.webp"
      progressStops={[18, 74]}
    />
  );
}
