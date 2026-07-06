import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'

if (!process.env.GOOGLE_SHEET_ID) {
  throw new Error('GOOGLE_SHEET_ID environment variable is missing in .env.local')
}

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

export const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth)

export async function getSheet(sheetName: string) {
  // Call loadInfo() to fetch sheet metadata before trying to retrieve tab
  await doc.loadInfo()

  console.log("Available sheets:", Object.keys(doc.sheetsByTitle))

  const sheet = doc.sheetsByTitle[sheetName]
  if (!sheet) {
    const availableSheets = Object.keys(doc.sheetsByTitle).join(', ')
    throw new Error(
      `Không tìm thấy ${sheetName}. Các tab hiện có: ${availableSheets || '(không có tab nào)'}`
    )
  }
  return sheet
}
