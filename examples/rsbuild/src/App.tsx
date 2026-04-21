import { DemoApp } from '../../shared/demo-app';

export function App() {
  return (
    <DemoApp
      consumerName="Rsbuild"
      consumerNote={{
        en: 'This one reads the same published surface from an Rsbuild consumer, so bundler parity stays visible without changing the API story.',
        jp: 'こちらは Rsbuild consumer から同じ公開面を読み、API の話を変えずに bundler parity を確認できます。'
      }}
      demoCommand="npm run dev --workspace examples/rsbuild"
      alternateDemoCommand="npm run dev --workspace examples/vite"
      uploadKeyPrefix="example/rsbuild"
    />
  );
}
