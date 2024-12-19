import os
import glob
from datetime import datetime, timedelta
import argparse
from swrad_geotiff import process_swrad

def convert_utc_to_kst(filename):
    """UTC 시간이 포함된 파일명을 KST로 변환"""
    # gk2a_ami_le2_swrad_ko020lc_202407070300.nc 형식에서 시간 추출
    dt_str = filename.split('_')[-1].replace('.nc', '')  # 202407070300
    dt = datetime.strptime(dt_str, '%Y%m%d%H%M')
    return dt + timedelta(hours=9)

def main():
    parser = argparse.ArgumentParser(description='SWRAD NC 파일들을 GeoTIFF로 일괄 변환')
    parser.add_argument('input_dir', help='입력 NC 파일이 있는 디렉토리 경로')
    parser.add_argument('--output-dir', help='출력 디렉토리 경로 (기본값: 입력 디렉토리와 동일)',
                        default=None)
    
    args = parser.parse_args()
    output_dir = args.output_dir if args.output_dir else args.input_dir
    os.makedirs(output_dir, exist_ok=True)
    
    # 입력 디렉토리의 모든 NC 파일 검색
    nc_files = glob.glob(os.path.join(args.input_dir, '*.nc'))
    
    if not nc_files:
        print(f"경고: {args.input_dir}에서 NC 파일을 찾을 수 없습니다.")
        return
    
    print(f"총 {len(nc_files)}개의 파일을 처리합니다...")
    
    for nc_file in sorted(nc_files):
        try:
            # KST 시간으로 변환하여 출력 파일명 생성
            kst = convert_utc_to_kst(os.path.basename(nc_file))
            basename = f"swrad_{kst.strftime('%Y%m%d%H%M')}"
            
            output_raw = os.path.join(output_dir, f"{basename}_raw.tif")
            output_colored = os.path.join(output_dir, f"{basename}_jet.tif")
            
            print(f"처리 중: {os.path.basename(nc_file)} -> {basename}")
            process_swrad(nc_file, output_raw, output_colored)
            
        except Exception as e:
            print(f"오류 발생 ({os.path.basename(nc_file)}): {str(e)}")
            continue

if __name__ == '__main__':
    main() 