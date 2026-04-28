import {
  ImageDropInput,
  type ImageDropInputProps,
  type ImageUploadValue
} from 'image-drop-input';
import 'image-drop-input/style.css';

const value: ImageUploadValue | null = null;

const props: ImageDropInputProps = {
  value,
  onChange(nextValue) {
    void nextValue;
  }
};

const node = <ImageDropInput {...props} />;

void node;
