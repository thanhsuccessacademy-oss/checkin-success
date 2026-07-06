/**
 * Utility to extract GPS coordinates from Google Maps URLs.
 * Handles desktop links, search parameters, and mobile shortened redirects (maps.app.goo.gl).
 * Supports standard places, search views, query coordinates, and dropped pins/unnamed coordinates.
 */
export async function extractCoordinates(url: string): Promise<{ latitude: number; longitude: number } | null> {
  let targetUrl = url

  // Resolve shortened URL redirects on the server side
  if (url.includes('maps.app.goo.gl') || url.includes('g.co/maps')) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
      })
      const redirectLocation = response.headers.get('location')
      if (redirectLocation) {
        targetUrl = redirectLocation
      }
    } catch (error) {
      console.error('Failed to resolve redirect for shortened map URL:', error)
    }
  }

  // Decode URI component to handle spaces and encoded + characters (%2B)
  try {
    targetUrl = decodeURIComponent(targetUrl)
  } catch (e) {
    // Fallback if decode fails
  }

  // 1. Check for standard @lat,lng format (e.g. /@10.7765,106.7009,17z)
  const atCoordsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/
  const atMatch = targetUrl.match(atCoordsRegex)
  if (atMatch) {
    return {
      latitude: parseFloat(atMatch[1]),
      longitude: parseFloat(atMatch[2]),
    }
  }

  // 2. Check for search path format (e.g. /search/10.021436,+105.767102)
  // Support optional spaces or plus signs in between coordinates
  const searchCoordsRegex = /\/search\/(-?\d+\.\d+),(?:\+|\s)*(-?\d+\.\d+)/
  const searchMatch = targetUrl.match(searchCoordsRegex)
  if (searchMatch) {
    return {
      latitude: parseFloat(searchMatch[1]),
      longitude: parseFloat(searchMatch[2]),
    }
  }

  // 3. Check for query parameters like q=lat,lng, query=lat,lng, or ll=lat,lng
  const queryCoordsRegex = /[?&](?:q|query|ll)=(-?\d+\.\d+),(?:\+|\s)*(-?\d+\.\d+)/
  const queryMatch = targetUrl.match(queryCoordsRegex)
  if (queryMatch) {
    return {
      latitude: parseFloat(queryMatch[1]),
      longitude: parseFloat(queryMatch[2]),
    }
  }

  return null
}
