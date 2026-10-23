import datetime as dt
import gzip
import unittest
from store_reports import parse_google, parse_apple

class ReportsTest(unittest.TestCase):
    def test_google_utf16_and_dates(self):
        csv='Date,Package Name,Daily User Installs,Daily Device Installs,Daily User Uninstalls,Installs on active devices,Total User Installs\r\n2026-10-21,uz.nfcstore.nova,4,5,1,20,30\r\n2026-10-22,uz.nfcstore.nova,7,8,2,25,37\r\n2026-10-23,uz.nfcstore.nova,99,99,0,99,99\r\n2026-10-22,uz.bugunbor.app,100,100,0,100,100\r\n'
        d=parse_google(csv.encode('utf-16'),'uz.nfcstore.nova',dt.date(2026,10,23))
        self.assertEqual(d['date'],'2026-10-22'); self.assertEqual(d['newUsers'],7)
        self.assertEqual(d['totalUsers'],37); self.assertEqual(len(d['days']),2)
    def test_duplicate_day_rejected(self):
        csv='Date,Package Name,Daily User Installs\n2026-10-22,uz.nfcstore.nova,1\n2026-10-22,uz.nfcstore.nova,2\n'
        with self.assertRaises(ValueError): parse_google(csv.encode(),'uz.nfcstore.nova',dt.date(2026,10,23))
    def test_missing_is_not_zero(self):
        self.assertIsNone(parse_google(b'Date,Package Name\n','uz.nfcstore.nova',dt.date(2026,10,23)))
        with self.assertRaises(ValueError): parse_google(b'Date,Package Name,Wrong\n2026-10-22,uz.nfcstore.nova,99','uz.nfcstore.nova',dt.date(2026,10,23))
    def test_apple_ignores_iap_and_separates_updates(self):
        tsv='Apple Identifier\tProduct Type Identifier\tUnits\n6818677020\t1F\t4\n6818677020\t3F\t2\n6818677020\t7F\t8\n6818677020\tIA1\t500\n6818677020\t1F\t-1\n6821543877\t1\t3\n'
        d=parse_apple(gzip.compress(tsv.encode()),'2026-10-22')
        self.assertEqual(d['uz.nfcstore.nova']['newDownloads'],4)
        self.assertEqual(d['uz.nfcstore.nova']['redownloads'],2)
        self.assertEqual(d['uz.nfcstore.nova']['updates'],8)
        self.assertEqual(d['uz.nfcstore.nova']['refunds'],1)
        self.assertEqual(d['uz.bugunbor.app']['newDownloads'],3)
        self.assertEqual(d['uz.labguide.app']['newDownloads'],0)

if __name__=='__main__': unittest.main()
