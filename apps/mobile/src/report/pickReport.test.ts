import * as DocumentPicker from 'expo-document-picker';

import { MAX_BYTES, TOO_LARGE, pickPdf } from './pickReport';

const mockArrayBuffer = jest.fn(async () => new ArrayBuffer(4));
jest.mock('@shopify/react-native-skia', () => ({ FilterMode: {}, ImageFormat: {}, MipmapMode: {}, Skia: {} }));
jest.mock('expo-image-picker', () => ({ UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' } }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn(() => ({ size: 0, arrayBuffer: () => mockArrayBuffer() })) }));
const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => mockArrayBuffer.mockClear());

test('pickPdf refuses a PDF over 20 MB before reading its bytes', async () => {
  getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///big.pdf', size: MAX_BYTES + 1 }] });
  await expect(pickPdf()).rejects.toThrow(TOO_LARGE);
  expect(mockArrayBuffer).not.toHaveBeenCalled();
});

test('pickPdf reads a PDF within the limit', async () => {
  getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///ok.pdf', size: 4 }] });
  expect(await pickPdf()).toEqual([{ bytes: new Uint8Array(4), mime: 'application/pdf' }]);
});
