import { ExampleApp } from '../../shared/ExampleApp';

export function App() {
  return (
    <ExampleApp
      consumerName="Rsbuild consumer example"
      uploadKey="example/rsbuild/cover-image.webp"
      progressStops={[24, 78]}
    />
  );
}
