import { PageHeader } from "@/components/ratelimit/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ExplainerPage() {
  return (
    <div className="container relative pb-16 mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sticky top-0 py-4 bg-background -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="How the Ratelimit Demo Works"
          description="A deep dive into the architecture and implementation of our global ratelimit performance comparison"
          actions={[
            <Link href="/" key="demo">
              <Button className="cursor-pointer">Try Demo</Button>
            </Link>,
            <a href="https://go.unkey.com/so-quick" key="app">
              <Button className="cursor-pointer">Read the code</Button>
            </a>,
          ]}
        />
      </div>

      <main className="flex flex-col gap-16 mt-12 mb-20 max-w-4xl mx-auto">
        <section>
          <h2 className="text-3xl font-bold mb-6">Overview</h2>
          <div className="prose prose-gray dark:prose-invert max-w-none text-lg leading-relaxed">
            <p className="mb-4">
              This demo compares the latency performance of two ratelimit services:
              <strong> Unkey</strong> and <strong>Upstash Redis</strong>
              (a popular Redis-based approach) across six global regions.
            </p>
            <p className="mb-4">
              The comparison runs on Vercel Edge Runtime, which automatically routes requests to the
              nearest edge location, providing a realistic test of how each service performs from
              different geographic locations.
            </p>
            <p>
              <strong>Important:</strong> We used AWS region us-east-1 for Upstash Redis. This is
              where Unkey is hosted however we are globally distributed to ensure a fair performance
              comparison with consistent infrastructure.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">Architecture</h2>

          <h3 className="text-2xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
            Frontend (React/Next.js)
          </h3>
          <ul className="space-y-2 mb-8 text-lg">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span>
                <strong>Test Configuration:</strong> Users can set the rate limit (requests per
                window) and duration (10s, 60s, or 5m)
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span>
                <strong>Parallel Testing:</strong> Simultaneously tests all 6 regions when you click
                "Test"
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span>
                <strong>Real-time Visualization:</strong> Displays latency data in line charts and
                bar charts using Recharts
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span>
                <strong>Data Persistence:</strong> Uses browser localStorage to maintain test
                history across sessions
              </span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-blue-600 dark:text-blue-400">
            Backend API Routes
          </h3>
          <p className="text-lg mb-4">
            Each region has its own API endpoint that runs on Vercel's Edge Runtime:
          </p>
          <ul className="grid grid-cols-2 gap-2 mb-6">
            <li className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/bom1</code>
              <span>Mumbai, India</span>
            </li>
            <li className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/fra1</code>
              <span>Frankfurt, Germany</span>
            </li>
            <li className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/iad1</code>
              <span>Washington, DC</span>
            </li>
            <li className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/kix1</code>
              <span>Osaka, Japan</span>
            </li>
            <li className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/lhr1</code>
              <span>London, UK</span>
            </li>
            <li className="flex items-center space-x-2">
              <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">/sfo1</code>
              <span>San Francisco, CA</span>
            </li>
          </ul>
          <p className="text-lg">
            Each endpoint is configured with{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">preferredRegion</code>{" "}
            to ensure the code runs in that specific geographic location.
          </p>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">How the Test Works</h2>

          <h3 className="text-2xl font-semibold mb-4 text-green-600 dark:text-green-400">
            1. User Identity
          </h3>
          <p className="text-lg mb-6">
            Each user gets a unique identifier stored in a cookie. This ensures consistent
            ratelimiting across test runs and prevents interference between different users.
          </p>

          <h3 className="text-2xl font-semibold mb-4 text-green-600 dark:text-green-400">
            2. Parallel Execution
          </h3>
          <p className="text-lg mb-4">
            When you click "Test", the frontend makes simultaneous POST requests to all 6 regional
            endpoints. Each endpoint:
          </p>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Configures both Unkey and Upstash ratelimiters with your specified settings
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Uses{" "}
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  performance.now()
                </code>{" "}
                to measure precise timing at the lambda level, ensuring accurate rate limiting
                metrics
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Runs both ratelimit checks in parallel using{" "}
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  Promise.all()
                </code>
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Returns the results including latency measurements</span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-green-600 dark:text-green-400">
            3. Latency Measurement
          </h3>
          <p className="text-lg mb-4">
            Latency is measured from the moment the ratelimit request starts until the response is
            received. This includes:
          </p>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Network round-trip time to the ratelimit service</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Processing time within the ratelimit service</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Any connection establishment overhead</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">Implementation Details</h2>

          <h3 className="text-2xl font-semibold mb-4 text-purple-600 dark:text-purple-400">
            Unkey Ratelimiting
          </h3>
          <pre className="bg-gray-100 dark:bg-gray-900 p-6 rounded-lg overflow-x-auto mb-4 text-sm border">
            {`const unkey = new UnkeyRatelimit({
  namespace: "ratelimit-demo",
  rootKey: env().RATELIMIT_DEMO_ROOT_KEY,
  limit,
  duration,
});

const result = await unkey.limit(\`\${id}-unkey-\${region}\`);`}
          </pre>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Uses Unkey's ratelimit service</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Each user gets a unique key per region to prevent cross-region interference
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Supports sliding window ratelimiting</span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-purple-600 dark:text-purple-400">
            Upstash Redis Ratelimiting
          </h3>
          <pre className="bg-gray-100 dark:bg-gray-900 p-6 rounded-lg overflow-x-auto mb-4 text-sm border">
            {`const upstash = new UpstashRatelimit({
  redis: Redis.fromEnv(),
  limiter: UpstashRatelimit.slidingWindow(limit, duration),
});

const result = await upstash.limit(\`\${id}-upstash-\${region}\`);`}
          </pre>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Uses Upstash global Redis compatible database with a primary in us-east-1
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Implements sliding window algorithm</span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">Separate keys per user and region for fair comparison</span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-purple-600 dark:text-purple-400">
            Response Format
          </h3>
          <p className="text-lg mb-4">Each regional endpoint returns:</p>
          <pre className="bg-gray-100 dark:bg-gray-900 p-6 rounded-lg overflow-x-auto text-sm border">
            {`{
  "time": 1703123456789,
  "unkey": {
    "success": true,
    "limit": 10,
    "remaining": 9,
    "reset": 1703123466789,
    "latency": 45.2
  },
  "upstash": {
    "success": true,
    "limit": 10,
    "remaining": 9,
    "reset": 1703123466789,
    "latency": 127.8
  }
}`}
          </pre>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">Data Visualization</h2>

          <h3 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400">
            Charts
          </h3>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                <strong>Bar Chart:</strong> Compares latest latency across all regions side-by-side
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                <strong>Line Charts:</strong> Show latency trends over time for each service
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                <strong>Region Cards:</strong> Display detailed metrics for the most recent test
              </span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400">
            Color Coding
          </h3>
          <p className="text-lg mb-4">
            Each region has a consistent color across all visualizations, making it easy to track
            performance patterns:
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#7a2c65" }} />
              <span className="text-lg">Mumbai: Purple</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#3b9e9d" }} />
              <span className="text-lg">Frankfurt: Teal</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#e27c9d" }} />
              <span className="text-lg">Washington DC: Pink</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#8a7141" }} />
              <span className="text-lg">Osaka: Brown</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#309e25" }} />
              <span className="text-lg">London: Green</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#f1d632" }} />
              <span className="text-lg">San Francisco: Yellow</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">Why This Matters</h2>

          <h3 className="text-2xl font-semibold mb-4 text-red-600 dark:text-red-400">
            Real-World Performance
          </h3>
          <p className="text-lg mb-4">This demo provides realistic performance data because:</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Tests run from actual edge locations where your users would be
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Includes real network latency and geographic distribution effects
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                Uses the same deployment architecture (Vercel Edge) many applications use
              </span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-red-600 dark:text-red-400">
            Key Performance Factors
          </h3>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                <strong>Geographic Distribution:</strong> How close the ratelimit service is to your
                users
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                <strong>Network Optimization:</strong> How well the service handles global
                connectivity
              </span>
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-3 mr-3 flex-shrink-0" />
              <span className="text-lg">
                <strong>Infrastructure Design:</strong> Whether the service is built for edge
                computing
              </span>
            </li>
          </ul>

          <h3 className="text-2xl font-semibold mb-4 text-red-600 dark:text-red-400">
            What the Results Show
          </h3>
          <p className="text-lg">
            Typically, you'll observe that Unkey demonstrates consistently lower latency across
            regions due to its edge-native architecture, while traditional Redis-based solutions may
            show higher latency especially from regions distant from the Redis instance.
          </p>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-6">Technical Notes</h2>

          <h3 className="text-2xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
            Edge Runtime
          </h3>
          <p className="text-lg mb-6">
            All API routes use{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              export const runtime = "edge"
            </code>{" "}
            to ensure they run on Vercel's Edge Runtime rather than Node.js, providing faster cold
            starts and better geographic distribution.
          </p>

          <h3 className="text-2xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
            Measurement Precision
          </h3>
          <p className="text-lg mb-6">
            We use{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              performance.now()
            </code>{" "}
            for sub-millisecond timing precision, ensuring accurate latency measurements even for
            very fast operations. This is run on the Lambda to ensure consistent and accurate timing
            measurements.
          </p>

          <h3 className="text-2xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
            Reset Functionality
          </h3>
          <p className="text-lg mb-6">
            The "Reset" button clears the user cookie, effectively giving you a fresh identity for
            testing. This is useful when you want to test different scenarios without being affected
            by previous rate limit state.
          </p>

          <h3 className="text-2xl font-semibold mb-4 text-indigo-600 dark:text-indigo-400">
            Data Persistence
          </h3>
          <p className="text-lg mb-6">
            Test results are stored in browser localStorage, so you can refresh the page or come
            back later and still see your test history. Data is scoped to the specific demo
            instance.
          </p>
        </section>

        <div className="flex flex-col gap-2 md:gap-1 md:flex-row justify-center mt-12">
          <Link href="/">
            <Button size="lg" className="w-full  px-8 py-3 text-lg cursor-pointer">
              Try the Demo Yourself
            </Button>
          </Link>
          <a href="https://go.unkey.com/so-quick">
            <Button size="lg" className="w-full px-8 py-3 text-lg cursor-pointer">
              Read the code
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
