# Ratelimit Performance Demo

A Next.js application that provides real-time performance comparison between [Unkey](https://unkey.com) and Upstash Redis rate limiting services across multiple global regions.

## 🌟 Overview

This demo application measures and visualizes the latency performance of two popular rate limiting solutions:

- **Unkey Ratelimit**: A globally distributed rate limiting service
- **Upstash Redis**: A popular Redis-based rate limiting approach

The comparison runs on Vercel Edge Runtime, which automatically routes requests to the nearest edge location, providing realistic performance measurements from different geographic locations worldwide.

## ✨ Features

- **Global Performance Testing**: Test rate limiting latency across 6 regions (Mumbai, Frankfurt, Washington DC, Osaka, London, San Francisco)
- **Real-time Visualization**: Interactive charts showing latency comparisons over time
- **Configurable Parameters**: Adjust rate limits (requests per time period) and duration windows
- **Side-by-side Comparison**: View both services' performance simultaneously
- **Persistent Data**: Results are stored locally for session-based analysis
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## 🏗️ Architecture

### Frontend (React/Next.js)
- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS 4 with custom design system
- **Charts**: Recharts for data visualization
- **State Management**: React hooks with local storage persistence
- **URL State**: nuqs for query parameter management

### Backend (Edge Runtime)
- **Runtime**: Vercel Edge Runtime for global distribution
- **API Routes**: Region-specific endpoints for each test location
- **Rate Limiting**:
  - Unkey SDK (`@unkey/ratelimit`)
  - Upstash SDK (`@upstash/ratelimit` with Redis)

### Infrastructure
- **Deployment**: Vercel platform with edge functions
- **Database**: Upstash Redis for Redis-based rate limiting
- **Regions**: 6 globally distributed test points

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Upstash Redis instance
- Unkey account with root key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/unkeyed/marketing
   cd marketing/apps/ratelimit
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env` file:
   ```bash
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
   RATELIMIT_DEMO_ROOT_KEY=your_unkey_root_key
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint URL | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis authentication token | Yes |
| `RATELIMIT_DEMO_ROOT_KEY` | Unkey root key for API access | Yes |

### Rate Limit Parameters

- **Limit**: Number of requests allowed (1-1000)
- **Duration**: Time window for the limit
  - `10s` - 10 seconds
  - `60s` - 60 seconds (1 minute)
  - `5m` - 5 minutes

## 📊 Usage

### Running Tests

1. **Configure Parameters**: Set your desired rate limit and duration
2. **Run Test**: Click the "Test" button to execute rate limit checks across all regions
3. **View Results**: Charts and metrics will update in real-time
4. **Compare Performance**: Analyze latency differences between services
5. **Reset**: Clear data and rate limits with the "Reset" button

### Understanding Results

#### Metrics Displayed
- **Result**: Pass/Ratelimited status
- **Remaining**: Requests remaining in current window
- **Limit**: Total requests allowed in the window
- **Latency**: Round-trip time in milliseconds

#### Chart Types
- **Line Charts**: Time-series latency data by region
- **Bar Charts**: Comparative latency across regions
- **Color Coding**: Each region has a unique color for easy identification

## 🛠️ API Routes

### Regional Endpoints

Each region has its own API endpoint that tests both services:

- `/bom1` - Mumbai, India
- `/fra1` - Frankfurt, Germany
- `/iad1` - Washington, DC
- `/kix1` - Osaka, Japan
- `/lhr1` - London, UK
- `/sfo1` - San Francisco

#### Request Format
```typescript 
POST /{region}
Content-Type: application/json

{
  "limit": number,
  "duration": "10s" | "60s" | "5m"
}
```

#### Response Format
```typescript
{
  "time": number,
  "unkey": {
    "success": boolean,
    "limit": number,
    "remaining": number,
    "reset": number,
    "latency": number
  },
  "upstash": {
    "success": boolean,
    "limit": number,
    "remaining": number,
    "reset": number,
    "latency": number
  }
}
```

### Utility Endpoints

- `POST /reset` - Reset all rate limits and clear data

## 🔧 Tech Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first styling
- **Recharts**: Data visualization library
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icon library

### Backend & APIs
- **Vercel Edge Runtime**: Global edge computing
- **Unkey SDK**: Rate limiting service integration
- **Upstash SDK**: Redis-based rate limiting
- **Zod**: Runtime type validation

### Development Tools
- **Turbo**: High-performance build system
- **Biome**: Fast linter and formatter
- **TypeScript**: Static type checking

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect Repository**: Link your Git repository to Vercel
2. **Configure Environment**: Add environment variables in Vercel dashboard
3. **Deploy**: Automatic deployment on git push

### Environment Setup
Ensure all required environment variables are configured in your deployment platform.

## 🎯 Performance Considerations

### Edge Runtime Benefits
- **Global Distribution**: Code runs close to users worldwide
- **Low Cold Start**: Faster function initialization
- **Automatic Scaling**: Handles traffic spikes seamlessly

### Rate Limiting Strategies
- **Sliding Window**: More accurate than fixed windows
- **User Identification**: Cookie-based consistent testing
- **Concurrent Testing**: Parallel execution across regions

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**


## 📝 License

This project is licensed under the AGPLv3 License - see the [LICENSE](../../LICENSE.md) file for details.

## 🔗 Links

- [Unkey](https://unkey.com) - Global rate limiting service
- [Upstash](https://upstash.com) - Serverless Redis platform
- [Next.js](https://nextjs.org) - React framework
- [Vercel](https://vercel.com) - Deployment platform

## 📞 Support

For questions or issues:
- Create an issue in this repository
- Visit [Unkey Documentation](https://unkey.com/docs)
- Check [Next.js Documentation](https://nextjs.org/docs)
