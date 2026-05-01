import {
  ImageDropInput,
  ImageUploadError,
  isImageUploadError,
  type ImageDropInputProps,
  type ImageUploadErrorDetails,
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
const uploadErrorDetails: ImageUploadErrorDetails = {
  stage: 'request',
  method: 'PUT',
  status: 413
};
const uploadError = new ImageUploadError(
  'http_error',
  'Upload failed: 413 Payload Too Large',
  uploadErrorDetails
);

void node;
void isImageUploadError(uploadError);
