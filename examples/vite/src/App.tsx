import { DemoApp } from '../../shared/demo-app';

export function App() {
  return (
    <DemoApp
      consumerName="Vite"
      consumerNote={{
        en: 'This one runs from a Vite consumer and exercises the published entrypoints rather than direct source imports.',
        jp: 'これは Vite consumer から published entrypoints を読む構成で、source 直参照ではありません。'
      }}
      demoCommand="npm run demo:vite"
      alternateDemoCommand="npm run demo:rsbuild"
      uploadKeyPrefix="example/vite"
    />
  );
}
