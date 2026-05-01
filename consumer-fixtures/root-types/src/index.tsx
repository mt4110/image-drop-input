import {
  ImageDropInput,
  ImageUploadError,
  ImageValidationError,
  isImageUploadError,
  type ImageDropInputProps,
  type ImageUploadErrorDetails,
  type ImageUploadErrorOptions,
  type ImageValidationErrorOptions,
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
const uploadErrorOptions: ImageUploadErrorOptions = {
  cause: new Error('upstream rejected')
};
const uploadError = new ImageUploadError(
  'http_error',
  'Upload failed: 413 Payload Too Large',
  uploadErrorDetails,
  uploadErrorOptions
);
const validationErrorOptions: ImageValidationErrorOptions = {
  cause: uploadError
};
const validationError = new ImageValidationError(
  'decode_failed',
  'Image metadata could not be read.',
  {
    actualBytes: 12,
    mimeType: 'image/png'
  },
  validationErrorOptions
);

void node;
void isImageUploadError(uploadError);
void validationError;
