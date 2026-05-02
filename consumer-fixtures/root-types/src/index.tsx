import {
  ImageDropInput,
  ImagePersistableValueError,
  ImageUploadError,
  ImageValidationError,
  assertPersistableImageValue,
  isPersistableImageValue,
  isImageUploadError,
  isTemporaryImageSrc,
  toPersistableImageValue,
  type ImageDropInputProps,
  type ImagePersistableValueErrorDetails,
  type ImagePersistableValueErrorOptions,
  type ImageUploadErrorDetails,
  type ImageUploadErrorOptions,
  type ImageValidationErrorOptions,
  type ImageUploadValue,
  type PersistableImageValue
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
const persistableValue: PersistableImageValue | null = toPersistableImageValue({
  src: 'https://cdn.example.com/avatar.webp',
  previewSrc: 'blob:preview'
});
const persistableDetails: ImagePersistableValueErrorDetails = {
  field: 'src',
  srcProtocol: 'blob:'
};
const persistableErrorOptions: ImagePersistableValueErrorOptions = {
  cause: validationError
};
const persistableError = new ImagePersistableValueError(
  'src_is_temporary',
  'Temporary image src cannot be persisted.',
  persistableDetails,
  persistableErrorOptions
);

void node;
void isImageUploadError(uploadError);
void isTemporaryImageSrc('blob:preview');
void isPersistableImageValue(persistableValue);
void assertPersistableImageValue(persistableValue);
void validationError;
void persistableError;
